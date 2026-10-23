// End-to-end check against a real relay. Skipped unless RELAY_URL is set:
//   RELAY_URL=wss://relay.example.com npm test
import { describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import { joinRoom } from './chat'
import { randomRoomId } from './names'

const RELAY = process.env.RELAY_URL
;(globalThis as { WebSocket: unknown }).WebSocket = WebSocket

const until = async (cond: () => boolean, ms = 8000) => {
  const end = Date.now() + ms
  while (!cond()) { if (Date.now() > end) throw new Error('timeout'); await new Promise((r) => setTimeout(r, 50)) }
}

describe.skipIf(!RELAY)('two people in a room', () => {
  const ids = new Map<string, string>()
  const reacts: string[] = []
  const typings: string[][] = []
  const join = (room: string, got: string[], roster: string[][]) =>
    joinRoom(room, RELAY!, {
      onMessage: (m) => { got.push(`${m.nick}: ${m.text}`); ids.set(m.text, m.id) },
      onTyping: (n) => typings.push(n),
      onReaction: (r) => reacts.push(`${r.emoji}${r.on ? '+' : '-'}`),
      onRoster: (l) => roster.push(l.filter((p) => !p.mine).map((p) => p.nick)),
      onStatus: () => {},
    })

  it('see each other, exchange messages, and a stranger room sees nothing', async () => {
    const room = randomRoomId()
    const gotA: string[] = [], gotB: string[] = [], gotC: string[] = [], rosterA: string[][] = []
    const a = await join(room, gotA, rosterA)
    await new Promise((r) => setTimeout(r, 500))
    const b = await join(room, gotB, [])
    const c = await join(randomRoomId(), gotC, [])
    await until(() => rosterA.some((l) => l.includes(b.nick)))
    expect(await a.say('hi from A')).toBeNull()
    expect(await b.say('hi from B ñ 👋')).toBeNull()
    await until(() => gotA.length >= 2 && gotB.length >= 2)
    expect(gotA).toContain(`${a.nick}: hi from A`)
    expect(gotA).toContain(`${b.nick}: hi from B ñ 👋`)
    expect(gotC).toEqual([])
    // "is typing" reaches the other person and ends when a message arrives
    b.typing()
    await until(() => typings.some((n) => n.includes(b.nick)))
    expect(await b.say('typed it')).toBeNull()
    await until(() => typings.at(-1)?.length === 0)
    // reactions reach the other person (and the sender's own echo), with the right message id
    const target = ids.get('hi from A')!
    expect(await b.react(target, '👍', true)).toBeNull()
    expect(await b.react(target, '👍', false)).toBeNull()
    await until(() => reacts.filter((r) => r.startsWith('👍')).length >= 4)
    expect(reacts).toContain('👍+')
    expect(reacts).toContain('👍-')
    ;[a, b, c].forEach((x) => x.leave())
  }, 30000)

  it('a room that keeps 24 h: whoever arrives later sees the messages and reactions from before, marked as old', async () => {
    const room = randomRoomId(86400)
    const gotA: string[] = []
    const a = await join(room, gotA, [])
    await new Promise((r) => setTimeout(r, 500))
    expect(await a.say('kept for later')).toBeNull()
    await until(() => gotA.length >= 1)
    expect(await a.react(ids.get('kept for later')!, '❤️', true)).toBeNull()
    a.leave()
    const late: { text: string; old: boolean }[] = [], lateReacts: string[] = []
    const b = await joinRoom(room, RELAY!, {
      onMessage: (m) => late.push({ text: m.text, old: m.old }),
      onTyping: () => {}, onRoster: () => {}, onStatus: () => {},
      onReaction: (r) => lateReacts.push(`${r.emoji}${r.on ? '+' : '-'}`),
    })
    await until(() => late.length >= 1 && lateReacts.length >= 1)
    expect(late).toEqual([{ text: 'kept for later', old: true }])
    expect(lateReacts).toEqual(['❤️+'])
    // an ephemeral room never shows anything from before
    const eph = randomRoomId(), early = await join(eph, [], [])
    await new Promise((r) => setTimeout(r, 500))
    expect(await early.say('gone')).toBeNull()
    early.leave()
    const seenLate: string[] = []
    const c = await join(eph, seenLate, [])
    await new Promise((r) => setTimeout(r, 1500))
    expect(seenLate).toEqual([])
    ;[b, c].forEach((x) => x.leave())
  }, 30000)
})
