import './style.css'
import { joinRoom } from './chat'
import { getLang, setLang, t, type Lang } from './i18n'
import { randomRoomId, validRoomId } from './names'

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

const log = $<HTMLUListElement>('log')
const statusEl = $('status')
let state: 'connecting' | 'open' | 'closed' = 'connecting'
let others: string[] = []

const STATUS = { connecting: 'connecting…', open: 'connected', closed: 'offline, retrying…' } as const

/** (Re)writes every text that depends on the language. */
function render() {
  document.documentElement.lang = getLang()
  document.title = t('Ephemeral chat')
  document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => (el.textContent = t(el.dataset.t as never)))
  document.querySelectorAll<HTMLInputElement>('[data-t-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.tPlaceholder as never)))
  statusEl.textContent = t(STATUS[state])
  statusEl.dataset.state = state
  $('online').textContent = others.length ? t('With: {names}', { names: others.join(', ') }) : t('Just you for now')
  $('lang').textContent = getLang() === 'en' ? 'ES' : 'EN'
  if (CUSTOM_RELAY) $('relay-link').title = t('Change relay')
}

function addLine(cls: string, nick: string, text: string, at: number) {
  const li = document.createElement('li')
  li.className = cls
  const who = document.createElement('b')
  who.textContent = nick
  const body = document.createElement('span')
  body.textContent = text // never innerHTML: other people write this
  const time = document.createElement('time')
  time.textContent = new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  li.append(who, body, time)
  const stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60
  log.append(li)
  while (log.children.length > 500) log.firstElementChild!.remove()
  if (stick) log.scrollTop = log.scrollHeight
}
// System notes are written in the language of the moment (they are not re-translated afterwards).
const note = (text: string) => addLine('note', '', text, Date.now())

const room = await joinRoom(roomId, relayUrl, {
  onStatus: (s) => { state = s; render() },
  onMessage: (m) => addLine(m.mine ? 'mine' : 'other', m.nick, m.text, m.at),
  onRoster: (list) => { others = list.filter((p) => !p.mine).map((p) => p.nick); render() },
})

$('me').textContent = room.nick
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
    // Relay reasons come in English; the few we generate ourselves are translated.
    const known = ['connection lost', 'not connected', 'no answer from the relay', 'the relay rejected it'] as const
    note(t('Not sent: {reason}', { reason: (known as readonly string[]).includes(err) ? t(err as (typeof known)[number]) : err }))
    input.value = text
  }
  input.focus()
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

$('lang').addEventListener('click', () => { setLang((getLang() === 'en' ? 'es' : 'en') as Lang); render() })

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

addEventListener('pagehide', () => room.leave())
