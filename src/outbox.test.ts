import { describe, expect, it } from 'vitest'
import { isRateLimited, Outbox, RESERVE, type Result } from './outbox'

/** A fake clock: sleeping just moves time forward. */
function clock() {
  const c = { t: 0, slept: [] as number[] }
  return { c, now: () => c.t, sleep: async (ms: number) => { c.slept.push(ms); c.t += ms } }
}
const ok: Result = { ok: true, reason: '' }
const limited: Result = { ok: false, reason: 'rate-limited: slow down, please' }

describe('Outbox', () => {
  it('lets a burst through, then makes messages wait for a free slot instead of failing', async () => {
    const k = clock()
    const box = new Outbox({ capacity: 5, perSecond: 1, now: k.now, sleep: k.sleep })
    let sent = 0
    for (let i = 0; i < 5; i++) expect((await box.send('high', async () => (sent++, ok))).ok).toBe(true)
    expect(k.c.slept).toEqual([]) // the burst needed no waiting
    expect((await box.send('high', async () => (sent++, ok))).ok).toBe(true)
    expect(sent).toBe(6)
    expect(k.c.slept.length).toBeGreaterThan(0) // the sixth one waited for the bucket to refill
    expect(k.c.t).toBeGreaterThanOrEqual(1000)
  })

  it('skips cosmetic events (typing, presence) when the bucket is low, and sends them when it is not', async () => {
    const k = clock()
    const box = new Outbox({ capacity: 12, perSecond: 0, now: k.now, sleep: k.sleep })
    let sent = 0
    const publish = async () => (sent++, ok)
    expect((await box.send('low', publish)).ok).toBe(true) // 12 tokens left >= 10
    expect((await box.send('low', publish)).ok).toBe(true) // 11
    expect((await box.send('low', publish)).ok).toBe(true) // 10
    expect(await box.send('low', publish)).toEqual({ ok: false, reason: 'skipped' }) // 9 < 10: dropped, not sent
    expect(sent).toBe(3)
    expect((await box.send('mid', publish)).ok).toBe(true) // presence still goes through (needs 3)
    expect(box.available()).toBeCloseTo(8, 5)
    expect(RESERVE.low).toBeGreaterThan(RESERVE.mid)
    expect(RESERVE.mid).toBeGreaterThan(RESERVE.high - 1)
  })

  it('retries a message by itself, with growing pauses, when the relay says rate-limited', async () => {
    const k = clock()
    const box = new Outbox({ capacity: 40, perSecond: 0.4, now: k.now, sleep: k.sleep })
    const answers = [limited, limited, ok]
    let calls = 0
    const r = await box.send('high', async () => answers[calls++])
    expect(r.ok).toBe(true)
    expect(calls).toBe(3)
    expect(k.c.slept).toEqual([2000, 4000])
  })

  it('says so every time it has to wait', async () => {
    const k = clock()
    const box = new Outbox({ now: k.now, sleep: k.sleep })
    let waits = 0
    await box.send('high', async () => (waits < 2 ? limited : ok), () => { waits++ })
    expect(waits).toBe(2)
  })

  it('gives up after the last retry and returns the relay reason', async () => {
    const k = clock()
    const box = new Outbox({ now: k.now, sleep: k.sleep })
    let calls = 0
    const r = await box.send('high', async () => (calls++, limited))
    expect(r).toEqual(limited)
    expect(calls).toBe(6) // the first try + 5 retries
    expect(k.c.slept).toEqual([2000, 4000, 8000, 16000, 32000])
    expect(k.c.slept.reduce((a, b) => a + b, 0)).toBeGreaterThan(60000) // longer than the relay's minute, which is how long its allowance can take to come back
  })

  it('does not retry other rejections, nor cosmetic events', async () => {
    const k = clock()
    const box = new Outbox({ now: k.now, sleep: k.sleep })
    let calls = 0
    expect((await box.send('high', async () => (calls++, { ok: false, reason: 'invalid: bad signature' }))).reason).toBe('invalid: bad signature')
    expect(calls).toBe(1)
    expect((await box.send('low', async () => (calls++, limited))).ok).toBe(false)
    expect(calls).toBe(2)
    expect(k.c.slept).toEqual([])
  })

  it('stops waiting for a free slot after maxWaitMs', async () => {
    const k = clock()
    const box = new Outbox({ capacity: 1, perSecond: 0, now: k.now, sleep: k.sleep, maxWaitMs: 3000 })
    expect((await box.send('high', async () => ok)).ok).toBe(true)
    const r = await box.send('high', async () => ok)
    expect(r.ok).toBe(false)
    expect(isRateLimited(r.reason)).toBe(true)
    expect(k.c.t).toBeGreaterThanOrEqual(3000)
  })
})

describe('isRateLimited', () => {
  it('recognises the relays wording', () => {
    for (const r of ['rate-limited: slow down, please', 'rate limit exceeded', 'too many events']) expect(isRateLimited(r), r).toBe(true)
    for (const r of ['invalid: bad signature', 'blocked: banned', 'not connected', '']) expect(isRateLimited(r), r).toBe(false)
  })
})
