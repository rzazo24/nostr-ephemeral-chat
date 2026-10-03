// The room protocol. Everything is an ephemeral event (20000–29999): the relay forwards it to whoever is subscribed and stores nothing.
//   20001  message         content = text encrypted with the room key
//   20002  heartbeat/join  content = encrypted "hello"; with a ["bye"] tag when leaving
// Both carry ["t", <hash of the room>]. Only whoever has the room id (URL fragment) can read the content.
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent } from 'nostr-tools/pure'
import type { Event } from 'nostr-tools'
import { decrypt, encrypt, roomKey, topicOf } from './crypto'
import { nickFromPubkey } from './names'
import { connectRelay, type RelayClient } from './relay'
import { PRESENCE_EVERY_MS, Roster } from './roster'

export const KIND_MESSAGE = 20001
export const KIND_PRESENCE = 20002
export const MAX_TEXT = 1000

export interface ChatEvents {
  onMessage(m: { id: string; pubkey: string; nick: string; text: string; at: number; mine: boolean }): void
  onRoster(nicks: { pubkey: string; nick: string; mine: boolean }[]): void
  onStatus(s: 'connecting' | 'open' | 'closed'): void
}

export async function joinRoom(roomId: string, relayUrl: string, ev: ChatEvents) {
  const sk = generateSecretKey() // a new identity on every visit, in memory only
  const pk = getPublicKey(sk)
  const [topic, key] = await Promise.all([topicOf(roomId), roomKey(roomId)])
  const roster = new Roster()
  const seenIds = new Set<string>()
  let client: RelayClient | undefined
  let welcome: ReturnType<typeof setTimeout> | undefined

  const emitRoster = () => ev.onRoster(roster.online().map((p) => ({ pubkey: p, nick: nickFromPubkey(p), mine: p === pk })))

  const send = async (kind: number, text: string, extra: string[][] = []) => {
    const event = finalizeEvent({ kind, created_at: Math.floor(Date.now() / 1000), tags: [['t', topic], ...extra], content: await encrypt(key, text) }, sk)
    return client!.publish(event)
  }
  const hello = () => send(KIND_PRESENCE, 'hello')

  client = connectRelay({
    url: relayUrl,
    filter: { kinds: [KIND_MESSAGE, KIND_PRESENCE], '#t': [topic], since: Math.floor(Date.now() / 1000) - 5 },
    onStatus: (s) => { ev.onStatus(s); if (s === 'open') hello() },
    onEvent: async (e: Event) => {
      if (seenIds.has(e.id) || !verifyEvent(e)) return
      if (e.kind !== KIND_MESSAGE && e.kind !== KIND_PRESENCE) return
      if (!e.tags.some((t) => t[0] === 't' && t[1] === topic)) return
      seenIds.add(e.id)
      const text = await decrypt(key, e.content)
      if (text === null) return // other room, or tampered
      if (e.kind === KIND_PRESENCE) {
        if (e.tags.some((t) => t[0] === 'bye')) roster.leave(e.pubkey)
        else if (roster.touch(e.pubkey) && e.pubkey !== pk && !welcome) {
          // Someone new: answer with a heartbeat (random delay so not everyone does it at once) so they learn we are here.
          welcome = setTimeout(() => { welcome = undefined; hello() }, 300 + Math.random() * 1700)
        }
        emitRoster()
        return
      }
      roster.touch(e.pubkey)
      emitRoster()
      ev.onMessage({ id: e.id, pubkey: e.pubkey, nick: nickFromPubkey(e.pubkey), text: text.slice(0, MAX_TEXT), at: e.created_at * 1000, mine: e.pubkey === pk })
    },
  })

  const beat = setInterval(() => { hello(); emitRoster() }, PRESENCE_EVERY_MS)

  return {
    pubkey: pk,
    nick: nickFromPubkey(pk),
    /** Sends a message. Returns the reason if the relay rejects it. */
    async say(text: string): Promise<string | null> {
      const clean = text.trim().slice(0, MAX_TEXT)
      if (!clean) return null
      const r = await send(KIND_MESSAGE, clean)
      return r.ok ? null : r.reason || 'the relay rejected it'
    },
    leave() {
      clearInterval(beat); clearTimeout(welcome)
      void send(KIND_PRESENCE, 'bye', [['bye']]).finally(() => client?.close())
    },
  }
}
