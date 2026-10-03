import { describe, expect, it } from 'vitest'
import { decrypt, encrypt, roomKey, topicOf } from './crypto'
import { nickFromPubkey, randomRoomId, validRoomId } from './names'
import { ONLINE_FOR_MS, Roster } from './roster'

describe('crypto', () => {
  it('decrypts with the same room and not with another', async () => {
    const a = await roomKey('roomaaaaaaaaaaaa'), b = await roomKey('roombbbbbbbbbbbb')
    const c = await encrypt(a, 'hello ñ 👋')
    expect(c).not.toContain('hello')
    expect(await decrypt(a, c)).toBe('hello ñ 👋')
    expect(await decrypt(b, c)).toBeNull()
    expect(await decrypt(a, 'garbage')).toBeNull()
  })
  it('the topic does not reveal the id and is stable', async () => {
    const t = await topicOf('roomaaaaaaaaaaaa')
    expect(t).toMatch(/^[0-9a-f]{32}$/)
    expect(t).toBe(await topicOf('roomaaaaaaaaaaaa'))
    expect(t).not.toBe(await topicOf('roombbbbbbbbbbbb'))
  })
})

describe('names', () => {
  it('valid and distinct rooms', () => {
    const r = randomRoomId()
    expect(validRoomId(r)).toBe(true)
    expect(r).not.toBe(randomRoomId())
    expect(validRoomId('x')).toBe(false)
    expect(validRoomId('<script>')).toBe(false)
  })
  it('stable nickname per key', () => {
    const k = 'ab12cd34ef56'.padEnd(64, '0')
    expect(nickFromPubkey(k)).toBe(nickFromPubkey(k))
  })
})

describe('roster', () => {
  it('expires the silent ones and reports newcomers', () => {
    let now = 0
    const r = new Roster(() => now)
    expect(r.touch('a')).toBe(true)
    expect(r.touch('a')).toBe(false)
    now += ONLINE_FOR_MS + 1
    expect(r.online()).toEqual([])
    expect(r.touch('a')).toBe(true)
    r.leave('a')
    expect(r.online()).toEqual([])
  })
})

import { Reactions, isReaction } from './reactions'
describe('reactions', () => {
  it('adds, counts per emoji, toggles off and ignores repeats', () => {
    const r = new Reactions()
    expect(r.apply('m1', '👍', 'a', true)).toBe(true)
    expect(r.apply('m1', '👍', 'a', true)).toBe(false) // repeated
    expect(r.apply('m1', '👍', 'b', true)).toBe(true)
    expect(r.apply('m1', '❤️', 'a', true)).toBe(true)
    expect(r.summary('m1', 'a')).toEqual([{ emoji: '👍', count: 2, mine: true }, { emoji: '❤️', count: 1, mine: true }])
    expect(r.summary('m1', 'z')[0].mine).toBe(false)
    expect(r.apply('m1', '👍', 'a', false)).toBe(true)
    expect(r.apply('m1', '👍', 'a', false)).toBe(false) // already gone
    expect(r.summary('m1', 'a')).toEqual([{ emoji: '👍', count: 1, mine: false }, { emoji: '❤️', count: 1, mine: true }])
    expect(r.apply('nope', '👍', 'a', false)).toBe(false)
    expect(r.summary('nope', 'a')).toEqual([])
  })
  it('only accepts the closed list', () => {
    expect(isReaction('👍')).toBe(true)
    expect(isReaction('💩')).toBe(false)
    expect(isReaction(5)).toBe(false)
  })
})
