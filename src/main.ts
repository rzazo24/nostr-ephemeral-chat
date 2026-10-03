import './style.css'
import { joinRoom } from './chat'
import { getLang, setLang, t, type Lang } from './i18n'
import { randomRoomId, validRoomId } from './names'
import { Reactions, REACTIONS, type Reaction } from './reactions'
import { EMOJIS } from './emojis'
import { splitLinks } from './linkify'
import * as notify from './notify'
import { qrDataUrl } from './qr'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// The deployed build is pinned to one relay (that is what lets the server send a strict CSP). Choosing another relay with
// ?relay=wss://… or from the footer is only enabled in development, or when built with VITE_ALLOW_CUSTOM_RELAY=1.
const DEFAULT_RELAY: string = import.meta.env.VITE_RELAY || 'wss://relay.hivescope.xyz'
const CUSTOM_RELAY = import.meta.env.DEV || import.meta.env.VITE_ALLOW_CUSTOM_RELAY === '1'
const relayUrl = (() => {
  const r = new URLSearchParams(location.search).get('relay')
  return CUSTOM_RELAY && r && /^wss?:\/\/\S+$/.test(r) ? r : DEFAULT_RELAY
})()

// Room: it lives in the fragment (#room) so it never reaches any server. Without a valid room a new one is created.
let roomId = location.hash.slice(1)
const isNew = !validRoomId(roomId)
if (isNew) {
  roomId = randomRoomId()
  history.replaceState(null, '', `${location.pathname}${location.search}#${roomId}`)
}

// Installable app: register the service worker (production only) and offer "Install" where the browser supports it.
// iOS has no install prompt: there the help explains "Share → Add to Home Screen".
// This runs before the first `await` below on purpose: after it, the page's `load` event may already have fired.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let updating = false // set when the user asks for the new version, so the first-install takeover does not reload the page
  const showUpdate = (reg: ServiceWorkerRegistration) => {
    $('update').hidden = false
    $('update-later').onclick = () => { $('update').hidden = true }
    $('update-reload').onclick = () => {
      updating = true
      reg.waiting?.postMessage('skip-waiting')
      setTimeout(() => location.reload(), 3000) // in case the worker never answers
    }
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updating) location.reload() })
  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      // A worker that finishes installing while another one controls the page is a new version waiting for us.
      const offer = () => { if (navigator.serviceWorker.controller) showUpdate(reg) }
      if (reg.waiting) offer()
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        w?.addEventListener('statechange', () => { if (w.state === 'installed') offer() })
      })
      // Long-lived tabs and installed apps do not navigate, so look for a new version now and then.
      const check = () => { reg.update().catch(() => { /* offline */ }) }
      setInterval(check, 30 * 60 * 1000)
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check() })
    } catch { /* works without it */ }
  }
  if (document.readyState === 'complete') void register()
  else addEventListener('load', () => void register())
}
interface InstallPromptEvent extends Event { prompt(): Promise<void> }
let installEvent: InstallPromptEvent | undefined
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e as InstallPromptEvent; $('install').hidden = false })
addEventListener('appinstalled', () => { installEvent = undefined; $('install').hidden = true })
$('install').addEventListener('click', async () => { await installEvent?.prompt(); installEvent = undefined; $('install').hidden = true })

const log = $<HTMLUListElement>('log')
const statusEl = $('status')
const statusText = $('status-text')
let state: 'connecting' | 'open' | 'closed' = 'connecting'
let people: { nick: string; mine: boolean }[] = []
let unread = 0
let bell = notify.isOn()

const STATUS = { connecting: 'connecting…', open: 'connected', closed: 'offline, retrying…' } as const

/** (Re)writes every text that depends on the language. */
function render() {
  document.documentElement.lang = getLang()
  const base = roomName ? `#${roomName} · ${t('Ephemeral chat')}` : t('Ephemeral chat')
  document.title = unread ? `(${unread}) ${base}` : base
  $('bell').setAttribute('aria-pressed', String(bell))
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as never)))
  document.querySelectorAll<HTMLElement>('[data-t-title]').forEach((el) => { el.title = t(el.dataset.tTitle as never); el.setAttribute('aria-label', el.title) })
  document.querySelectorAll<HTMLInputElement>('[data-t-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.tPlaceholder as never)))
  statusText.textContent = t(STATUS[state])
  statusEl.dataset.state = state
  $('people-summary').textContent = t('In the room: {n}', { n: String(people.length) })
  $('online').replaceChildren(...people.map((p) => Object.assign(document.createElement('li'), { textContent: p.mine ? `${p.nick} ${t('(you)')}` : p.nick, className: p.mine ? 'me' : '' })))
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())))
  if (CUSTOM_RELAY) $('relay-link').title = t('Change relay')
}

// Relay reasons come in English; the few we generate ourselves are translated.
const KNOWN = ['connection lost', 'not connected', 'no answer from the relay', 'the relay rejected it'] as const
const knownReason = (err: string) => ((KNOWN as readonly string[]).includes(err) ? t(err as (typeof KNOWN)[number]) : err)

/** True when the user is not looking at the chat (another tab, minimised, another window). */
const away = () => document.hidden || !document.hasFocus()
const seen = () => { if (unread) { unread = 0; render() } }
document.addEventListener('visibilitychange', () => { if (!document.hidden) seen() })
addEventListener('focus', seen)

const reactions = new Reactions()
const bubbles = new Map<string, HTMLElement>() // message id -> its reactions bar
let me = ''
let roomName = ''

function addLine(cls: string, nick: string, text: string, at: number, id?: string) {
  const li = document.createElement('li')
  li.className = cls
  const who = document.createElement('b')
  who.textContent = nick
  const body = document.createElement('span')
  // Links become <a>; everything else is a text node (never innerHTML: other people write this).
  for (const part of splitLinks(text)) {
    if (!part.url) { body.append(part.text); continue }
    const a = document.createElement('a')
    a.href = part.url
    a.textContent = part.text
    a.target = '_blank'
    a.rel = 'noopener noreferrer nofollow'
    a.referrerPolicy = 'no-referrer'
    body.append(a)
  }
  const time = document.createElement('time')
  time.textContent = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  li.append(who, body, time)
  if (id) {
    const bar = document.createElement('div')
    bar.className = 'reactions'
    li.append(bar)
    bubbles.set(id, bar)
    renderReactions(id)
  }
  const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60
  log.append(li)
  while (log.children.length > 500) {
    const first = log.firstElementChild as HTMLElement
    for (const [k, v] of bubbles) if (first.contains(v)) bubbles.delete(k)
    first.remove()
  }
  if (stick) log.scrollTop = log.scrollHeight
}

/** Draws the chips of a message (one per emoji with its count) plus the "add reaction" button. */
function renderReactions(id: string) {
  const bar = bubbles.get(id)
  if (!bar) return
  const chips = reactions.summary(id, me).map((r) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip' + (r.mine ? ' mine' : '')
    b.textContent = `${r.emoji} ${r.count}`
    b.setAttribute('aria-pressed', String(r.mine))
    b.addEventListener('click', () => toggleReaction(id, r.emoji, !r.mine))
    return b
  })
  const add = document.createElement('button')
  add.type = 'button'
  add.className = 'chip add'
  add.textContent = '☺+'
  add.title = t('React')
  add.setAttribute('aria-label', t('React'))
  add.addEventListener('click', (e) => { e.stopPropagation(); openPalette(id, add) })
  bar.replaceChildren(...chips, add)
}

async function toggleReaction(id: string, emoji: Reaction, on: boolean) {
  closePalette()
  // Optimistic: show it at once; the relay echo (same pubkey, same state) changes nothing.
  if (reactions.apply(id, emoji, me, on)) renderReactions(id)
  const err = await room.react(id, emoji, on)
  if (err) {
    if (reactions.apply(id, emoji, me, !on)) renderReactions(id)
    note(t('Not sent: {reason}', { reason: knownReason(err) }))
  }
}

// One shared palette (fixed position, so the scrolling chat does not clip it).
const palette = $('palette')
function openPalette(id: string, anchor: HTMLElement) {
  const mine = new Set(reactions.summary(id, me).filter((r) => r.mine).map((r) => r.emoji))
  palette.replaceChildren(...REACTIONS.map((emoji) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'chip' + (mine.has(emoji) ? ' mine' : '')
    b.textContent = emoji
    b.addEventListener('click', () => toggleReaction(id, emoji, !mine.has(emoji)))
    return b
  }))
  palette.hidden = false
  const r = anchor.getBoundingClientRect()
  const w = palette.offsetWidth, h = palette.offsetHeight
  palette.style.left = `${Math.max(8, Math.min(r.left, innerWidth - w - 8))}px`
  palette.style.top = `${r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6}px`
}
function closePalette() { palette.hidden = true }
// System notes are written in the language of the moment (they are not re-translated afterwards).
const note = (text: string) => addLine('note', '', text, Date.now())

const room = await joinRoom(roomId, relayUrl, {
  onStatus: (s) => { state = s; render() },
  onMessage: (m) => {
    addLine(m.mine ? 'mine' : 'other', m.nick, m.text, m.at, m.id)
    if (m.mine || !away()) return
    unread++
    render()
    if (bell) notify.ping(t('New message in {room}', { room: `#${roomName}` }), t('New message from {nick}', { nick: m.nick }))
  },
  onTyping: (nicks) => {
    $('typing').textContent = !nicks.length ? '' : nicks.length === 1 ? t('{names} is typing…', { names: nicks[0] }) : nicks.length === 2 ? t('{names} are typing…', { names: nicks.join(' & ') }) : t('Several people are typing…')
  },
  onReaction: (r) => {
    // Our own echo changes nothing: it was already applied when we clicked.
    if (reactions.apply(r.messageId, r.emoji, r.pubkey, r.on)) renderReactions(r.messageId)
  },
  onRoster: (list) => { people = [...list].sort((a, b) => Number(b.mine) - Number(a.mine) || a.nick.localeCompare(b.nick)); render() },
})

$('me').textContent = room.nick
me = room.pubkey
roomName = room.roomName
$('room-name').textContent = `#${roomName}`
people = [{ nick: room.nick, mine: true }]
$('relay-link').textContent = relayUrl.replace(/^wss?:\/\//, '')
render()
note(isNew ? t('New room. Copy the link and send it to whoever you like.') : t('You joined a room. You will only see what is written from now on.'))
note(t('Whoever joins later will not see what came before: nothing is stored.'))

$<HTMLFormElement>('form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('text')
  const text = input.value
  if (!text.trim()) return
  input.value = ''
  const err = await room.say(text)
  if (err) {
    note(t('Not sent: {reason}', { reason: knownReason(err) }))
    input.value = text
  }
  input.focus()
})

// Native share sheet (phones, some desktops); the plain copy button is always there.
if (typeof navigator.share === 'function') {
  const btn = $('share-native')
  btn.hidden = false
  btn.addEventListener('click', () => { navigator.share({ title: document.title, url: location.href }).catch(() => { /* cancelled */ }) })
}

// QR code of the room link, for passing it to a phone next to you.
const qr = $<HTMLDialogElement>('qr')
$('qr-btn').addEventListener('click', () => { $<HTMLImageElement>('qr-img').src = qrDataUrl(location.href); qr.showModal() })
$('qr-close').addEventListener('click', () => qr.close())
qr.addEventListener('click', (e) => { if (e.target === qr) qr.close() })

// Bell: sound + notification for messages that arrive while you are away.
$('bell').addEventListener('click', async () => {
  const r = await notify.setOn(!bell)
  bell = r.on
  render()
  note(!bell ? t('Notifications off.') : r.blocked ? t('Notifications are blocked in this browser, so only the sound and the counter will work.') : t('Notifications on: you will hear a sound and see a counter in the tab title when you are away.'))
})

$('share').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('share')
  try { await navigator.clipboard.writeText(location.href); btn.textContent = t('Copied!') }
  catch { prompt(t('Copy the link:'), location.href) }
  setTimeout(render, 1500)
})

$('new').addEventListener('click', () => {
  room.leave()
  location.hash = ''
  setTimeout(() => location.reload(), 150)
})

document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.addEventListener('click', () => { setLang(b.dataset.lang as Lang); render() }))

if (CUSTOM_RELAY) {
  $('relay-link').addEventListener('click', (e) => {
    e.preventDefault()
    const v = prompt(t('Relay address (wss://…). A new room will open on it:'), relayUrl)
    if (v && /^wss?:\/\/\S+$/.test(v) && v !== relayUrl) {
      room.leave()
      location.href = `${location.pathname}?relay=${encodeURIComponent(v)}`
    }
  })
} else {
  $('relay-link').removeAttribute('href')
}

// Help dialog (native <dialog>: Escape closes it; a click on the backdrop does too).
const help = $<HTMLDialogElement>('help')
$('help-btn').addEventListener('click', () => help.showModal())
$('help-close').addEventListener('click', () => help.close())
help.addEventListener('click', (e) => { if (e.target === help) help.close() })

// Emoji picker for the message box (own panel, no library). Inserts at the cursor.
const emojiPanel = $('emoji-panel'), emojiBtn = $<HTMLButtonElement>('emoji-btn'), textInput = $<HTMLInputElement>('text')
emojiPanel.replaceChildren(...EMOJIS.map((emoji) => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = emoji
  b.setAttribute('aria-label', emoji)
  b.addEventListener('click', () => {
    const a = textInput.selectionStart ?? textInput.value.length, z = textInput.selectionEnd ?? a
    if (textInput.value.length - (z - a) + emoji.length > textInput.maxLength) return
    textInput.setRangeText(emoji, a, z, 'end')
    textInput.focus()
  })
  return b
}))
emojiBtn.addEventListener('click', () => {
  emojiPanel.hidden = !emojiPanel.hidden
  emojiBtn.setAttribute('aria-expanded', String(!emojiPanel.hidden))
  if (!emojiPanel.hidden) log.scrollTop = log.scrollHeight
})

// Tell the room you are typing (throttled inside).
textInput.addEventListener('input', () => { if (textInput.value.trim()) room.typing() })

document.addEventListener('click', (e) => { if (!palette.hidden && !palette.contains(e.target as Node)) closePalette() })
addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePalette(); $<HTMLDetailsElement>('people').open = false } })
log.addEventListener('scroll', closePalette)

// Close the people list when clicking anywhere else.
document.addEventListener('click', (e) => { const d = $<HTMLDetailsElement>('people'); if (d.open && !d.contains(e.target as Node)) d.open = false })

addEventListener('pagehide', () => room.leave())
