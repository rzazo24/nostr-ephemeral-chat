import { beforeEach, describe, expect, it, vi } from 'vitest'

const mem = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) })
const { forgetRoom, lastRoom, rememberRoom } = await import('./lastroom')

describe('the last room that keeps its messages', () => {
  beforeEach(() => mem.clear())
  it('remembers only rooms that keep messages, and only while what was there can still exist', () => {
    rememberRoom('abcdefghijkmnpqr', 'aaa-bbb-ccc', 0)
    expect(lastRoom(0)).toBeNull() // ephemeral: nothing to go back to
    rememberRoom('abcdefghijkmnpqr-24h', 'kfm-7xq-d4p', 1000)
    expect(lastRoom(1000 + 3_600_000)).toEqual({ id: 'abcdefghijkmnpqr-24h', name: 'kfm-7xq-d4p', seenAt: 1000 })
    expect(lastRoom(1000 + 86_400_000 + 1)).toBeNull() // a day later everything in it has expired
    expect(mem.size).toBe(0) // and it is forgotten
  })
  it('a week for a 7-day room; Forget forgets; anything odd in storage is ignored', () => {
    rememberRoom('abcdefghijkmnpqr-7d', 'x', 0)
    expect(lastRoom(6 * 86_400_000)?.id).toBe('abcdefghijkmnpqr-7d')
    forgetRoom()
    expect(lastRoom(0)).toBeNull()
    mem.set('chat-last-kept-room', '{"id":"<script>","name":"x","seenAt":0}')
    expect(lastRoom(0)).toBeNull()
    mem.set('chat-last-kept-room', 'not json')
    expect(lastRoom(0)).toBeNull()
  })
})
