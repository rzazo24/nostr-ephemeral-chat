// The room protocol. Everything is an ephemeral event (20000–29999): the relay forwards it to whoever is subscribed and stores nothing.
//   20001  message         content = text encrypted with the room key
//   20002  presence        content = encrypted "hello!" (heartbeat/join) or "typing" (same length, so the relay cannot tell them
//                          apart); with a ["bye"] tag when leaving
//   20003  reaction        content = encrypted {"e":<emoji>,"on":true|false}; tag ["e", <message id>]
// All carry ["t", <hash of the room>]. Only whoever has the room id (URL fragment) can read the content.
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure'
import type { Event } from 'nostr-tools'
import { decrypt, encrypt, roomKey, topicOf } from './crypto'
import { nickFromPubkey, roomNameFromTopic } from './names'
import { connectRelay, type RelayClient } from './relay'
import { isReaction, type Reaction } from './reactions'
import { PRESENCE_EVERY_MS, Roster } from './roster'
import { Typing, TYPING_EVERY_MS } from './typing'

export const KIND_MESSAGE = 20001
export const KIND_PRESENCE = 20002
export const KIND_REACTION = 20003
export const MAX_TEXT = 1000

export interface ChatEvents {
  onMessage(m: { id: string; pubkey: string; nick: string; text: string; at: number; mine: boolean }): void
  onReaction(r: { messageId: string; emoji: Reaction; pubkey: string; on: boolean }): void
  onTyping(nicks: string[]): void
  onRoster(nicks: { pubkey: string; nick: string; mine: boolean }[]): void
  onStatus(s: 'connecting' | 'open' | 'closed'): void
}

export async function joinRoom(roomId: string, relayUrl: string, ev: ChatEvents) {
  const sk = generateSecretKey() // a new identity on every visit, in memory only
  const pk = getPublicKey(sk)
  const [topic, key] = await Promise.all([topicOf(roomId), roomKey(roomId)])
  const roster = new Roster()
  const typing = new Typing()
  let typingShown = ''
  let lastTypingSent = 0
  const seenIds = new Set<string>()
  let client: RelayClient | undefined
  let welcome: ReturnType<typeof setTimeout> | undefined

  const emitRoster = () => ev.onRoster(roster.online().map((p) => ({ pubkey: p, nick: nickFromPubkey(p), mine: p === pk })))

  const send = async (kind: number, text: string, extra: string[][] = []) => {
    const event = finalizeEvent({ kind, created_at: Math.floor(Date.now() / 1000), tags: [['t', topic], ...extra], content: await encrypt(key, text) }, sk)
    return client!.publish(event)
  }
  const emitTyping = () => {
    const nicks = typing.active().filter((p) => p !== pk).map(nickFromPubkey).sort()
    if (nicks.join() !== typingShown) { typingShown = nicks.join(); ev.onTyping(nicks) }
  }
  const hello = () => send(KIND_PRESENCE, 'hello!')

  client = connectRelay({
    url: relayUrl,
    filter: { kinds: [KIND_MESSAGE, KIND_PRESENCE, KIND_REACTION], '#t': [topic], since: Math.floor(Date.now() / 1000) - 5 },
    onStatus: (s) => { ev.onStatus(s); if (s === 'open') hello() },
    onEvent: async (e: Event) => {
      if (seenIds.has(e.id) || !verifyEvent(e)) return
      if (e.kind !== KIND_MESSAGE && e.kind !== KIND_PRESENCE && e.kind !== KIND_REACTION) return
      if (!e.tags.some((t) => t[0] === 't' && t[1] === topic)) return
      seenIds.add(e.id)
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
      roster.touch(e.pubkey)
      emitRoster()
      if (e.kind === KIND_REACTION) {
        const target = e.tags.find((t) => t[0] === 'e')?.[1]
        let body: { e?: unknown; on?: unknown }
        try { body = JSON.parse(text) } catch { return }
        if (typeof target === 'string' && /^[0-9a-f]{64}$/.test(target) && isReaction(body.e) && typeof body.on === 'boolean')
          ev.onReaction({ messageId: target, emoji: body.e, pubkey: e.pubkey, on: body.on })
        return
      }
      typing.clear(e.pubkey) // a message ends "is typing"
      emitTyping()
      ev.onMessage({ id: e.id, pubkey: e.pubkey, nick: nickFromPubkey(e.pubkey), text: text.slice(0, MAX_TEXT), at: e.created_at * 1000, mine: e.pubkey === pk })
    },
  })

  const beat = setInterval(() => { hello(); emitRoster() }, PRESENCE_EVERY_MS)
  const expire = setInterval(emitTyping, 1000)

  return {
    pubkey: pk,
    roomName: roomNameFromTopic(topic),
    nick: nickFromPubkey(pk),
    /** Tells the room you are typing (at most one beat every few seconds). */
    typing() {
      const now = Date.now()
      if (now - lastTypingSent < TYPING_EVERY_MS) return
      lastTypingSent = now
      void send(KIND_PRESENCE, 'typing')
    },
    /** Sends a message. Returns the reason if the relay rejects it. */
    async say(text: string): Promise<string | null> {
      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean) return null
      const r = await send(KIND_MESSAGE, clean)
      return r.ok ? null : r.reason || 'the relay rejected it'
    },
    /** Adds or removes your reaction to a message. Returns the reason if the relay rejects it. */
    async react(messageId: string, emoji: Reaction, on: boolean): Promise<string | null> {
      const r = await send(KIND_REACTION, JSON.stringify({ e: emoji, on }), [['e', messageId]])
      return r.ok ? null : r.reason || 'the relay rejected it'
    },
    leave() {
      clearInterval(beat); clearInterval(expire); clearTimeout(welcome)
      void send(KIND_PRESENCE, 'bye!!!', [['bye']]).finally(() => client?.close())
    },
  }
}
