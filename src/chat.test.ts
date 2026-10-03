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
