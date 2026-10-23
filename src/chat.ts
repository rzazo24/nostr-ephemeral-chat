// The room protocol. Everything is an ephemeral event (20000–29999): the relay forwards it to whoever is subscribed and stores nothing.
//   20001  message         content = text encrypted with the room key
//   20002  presence        content = encrypted "hello!" (heartbeat/join) or "typing" (same length, so the relay cannot tell them
//                          apart); with a ["bye"] tag when leaving
//   20003  reaction        content = encrypted {"e":<emoji>,"on":true|false}; tag ["e", <message id>]
// All carry ["t", <hash of the room>]. Only whoever has the room id (URL fragment) can read the content.
// Rooms created to keep their history (24 h or 7 days, see names.ts) send messages and reactions as normal kinds the relay stores,
// with a NIP-40 expiration: 4201 message, 4203 reaction. Presence and "is typing" stay ephemeral in every room.
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure'
import type { Event } from 'nostr-tools'
import { decrypt, encrypt, roomKey, topicOf } from './crypto'
import { keepOf, nickFromPubkey, roomNameFromTopic, type Keep } from './names'
import { connectRelay, type RelayClient } from './relay'
import { Outbox, type Priority } from './outbox'
import { isReaction, type Reaction } from './reactions'
import { PRESENCE_EVERY_MS, Roster } from './roster'
import { Typing, TYPING_EVERY_MS } from './typing'

export const KIND_MESSAGE = 20001
export const KIND_PRESENCE = 20002
export const KIND_REACTION = 20003
export const KIND_KEPT_MESSAGE = 4201
export const KIND_KEPT_REACTION = 4203
export const MAX_TEXT = 1000

export interface ChatEvents {
  /** `old`: it was already in the room's history when you arrived (no notification for it). */
  onMessage(m: { id: string; pubkey: string; nick: string; text: string; at: number; mine: boolean; old: boolean }): void
  onReaction(r: { messageId: string; emoji: Reaction; pubkey: string; on: boolean }): void
  onTyping(nicks: string[]): void
  onRoster(nicks: { pubkey: string; nick: string; mine: boolean }[]): void
  onStatus(s: 'connecting' | 'open' | 'closed'): void
}

export async function joinRoom(roomId: string, relayUrl: string, ev: ChatEvents) {
  const sk = generateSecretKey() // a new identity on every visit, in memory only
  const pk = getPublicKey(sk)
  const [topic, key] = await Promise.all([topicOf(roomId), roomKey(roomId)])
  const keep: Keep = keepOf(roomId)
  const MSG = keep ? KIND_KEPT_MESSAGE : KIND_MESSAGE, RXN = keep ? KIND_KEPT_REACTION : KIND_REACTION
  // what the relay holds from before arriving: kept until it has all been received, then shown oldest first
  let live = false
  let early: Event[] = []
  const outbox = new Outbox()
  const roster = new Roster()
  const typing = new Typing()
  let typingShown = ''
  let lastTypingSent = 0
  const seenIds = new Set<string>()
  let client: RelayClient | undefined
  let welcome: ReturnType<typeof setTimeout> | undefined

  const emitRoster = () => ev.onRoster(roster.online().map((p) => ({ pubkey: p, nick: nickFromPubkey(p), mine: p === pk })))

  // Messages and reactions are 'high' (they wait for a free slot and are retried); presence is 'mid'; "is typing" beats are 'low'
  // and are the first thing dropped when the budget is short (see outbox.ts).
  const send = async (kind: number, text: string, extra: string[][] = [], priority: Priority = 'high', onWait?: () => void) => {
    const now = Math.floor(Date.now() / 1000)
    const expires = kind === KIND_KEPT_MESSAGE || kind === KIND_KEPT_REACTION ? [['expiration', String(now + keep)]] : []
    const event = finalizeEvent({ kind, created_at: now, tags: [['t', topic], ...extra, ...expires], content: await encrypt(key, text) }, sk)
    return outbox.send(priority, () => client!.publish(event), onWait)
  }
  const emitTyping = () => {
    const nicks = typing.active().filter((p) => p !== pk).map(nickFromPubkey).sort()
    if (nicks.join() !== typingShown) { typingShown = nicks.join(); ev.onTyping(nicks) }
  }
  const hello = () => send(KIND_PRESENCE, 'hello!', [], 'mid')

  const handle = async (e: Event, old: boolean) => {
    const text = await decrypt(key, e.content)
    if (text === null) return // other room, or tampered
    if (e.kind === KIND_PRESENCE) {
      if (e.tags.some((t) => t[0] === 'bye')) { roster.leave(e.pubkey); typing.clear(e.pubkey) }
      else if (text === 'typing') { roster.touch(e.pubkey); typing.mark(e.pubkey) }
      else if (roster.touch(e.pubkey) && e.pubkey !== pk && !welcome) {
        // Someone new: answer with a heartbeat (random delay so not everyone does it at once) so they learn we are here.
        welcome = setTimeout(() => { welcome = undefined; hello() }, 300 + Math.random() * 1700)
      }
      emitRoster()
      emitTyping()
      return
    }
    if (!old) { roster.touch(e.pubkey); emitRoster() } // history says nothing about who is here now
    if (e.kind === RXN) {
      const target = e.tags.find((t) => t[0] === 'e')?.[1]
      let body: { e?: unknown; on?: unknown }
      try { body = JSON.parse(text) } catch { return }
      if (typeof target === 'string' && /^[0-9a-f]{64}$/.test(target) && isReaction(body.e) && typeof body.on === 'boolean')
        ev.onReaction({ messageId: target, emoji: body.e, pubkey: e.pubkey, on: body.on })
      return
    }
    if (!old) { typing.clear(e.pubkey); emitTyping() } // a message ends "is typing"
    ev.onMessage({ id: e.id, pubkey: e.pubkey, nick: nickFromPubkey(e.pubkey), text: text.slice(0, MAX_TEXT), at: e.created_at * 1000, mine: e.pubkey === pk, old })
  }
  const expired = (e: Event) => { const x = Number(e.tags.find((t) => t[0] === 'expiration')?.[1]); return Number.isFinite(x) && x <= Date.now() / 1000 }

  const since = Math.floor(Date.now() / 1000) - 5
  client = connectRelay({
    url: relayUrl,
    filters: keep
      ? [{ kinds: [KIND_PRESENCE], '#t': [topic], since }, { kinds: [MSG, RXN], '#t': [topic], since: Math.floor(Date.now() / 1000) - keep - 600 }]
      : [{ kinds: [MSG, KIND_PRESENCE, RXN], '#t': [topic], since }],
    onStatus: (s) => { if (s === 'open') { live = false; early = [] } ev.onStatus(s); if (s === 'open') hello() },
    onEose: () => {
      // oldest first, so a reaction finds its message and the last on/off of a reaction wins
      const batch = early.sort((x, y) => x.created_at - y.created_at || (x.kind === MSG ? -1 : 1))
      early = []; live = true
      void (async () => { for (const e of batch) await handle(e, true) })()
    },
    onEvent: (e: Event) => {
      if (seenIds.has(e.id) || !verifyEvent(e)) return
      if (e.kind !== MSG && e.kind !== KIND_PRESENCE && e.kind !== RXN) return
      if (!e.tags.some((t) => t[0] === 't' && t[1] === topic) || expired(e)) return
      seenIds.add(e.id)
      if (!live && e.kind !== KIND_PRESENCE) { early.push(e); return }
      void handle(e, false)
    },
  })

  const beat = setInterval(() => { hello(); emitRoster() }, PRESENCE_EVERY_MS)
  const expire = setInterval(emitTyping, 1000)

  return {
    pubkey: pk,
    roomName: roomNameFromTopic(topic),
    /** Seconds this room keeps its messages (0 = nothing is stored). */
    keep,
    nick: nickFromPubkey(pk),
    /** Tells the room you are typing (at most one beat every few seconds). */
    typing() {
      const now = Date.now()
      if (now - lastTypingSent < TYPING_EVERY_MS) return
      lastTypingSent = now
      void send(KIND_PRESENCE, 'typing', [], 'low')
    },
    /** Sends a message. Returns the reason if the relay rejects it. `onWait` is called each time it has to wait before a retry. */
    async say(text: string, onWait?: () => void): Promise<string | null> {
      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean) return null
      const r = await send(MSG, clean, [], 'high', onWait)
      return r.ok ? null : r.reason || 'the relay rejected it'
    },
    /** Adds or removes your reaction to a message. Returns the reason if the relay rejects it. */
    async react(messageId: string, emoji: Reaction, on: boolean): Promise<string | null> {
      const r = await send(RXN, JSON.stringify({ e: emoji, on }), [['e', messageId]])
      return r.ok ? null : r.reason || 'the relay rejected it'
    },
    leave() {
      clearInterval(beat); clearInterval(expire); clearTimeout(welcome)
      void send(KIND_PRESENCE, 'bye!!!', [['bye']], 'mid').finally(() => client?.close())
    },
  }
}
