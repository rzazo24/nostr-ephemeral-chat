// Everything the app sends goes through here. A relay limits how many events one IP may publish (the default relay: up to 60 in a row,
// then 30 more at every minute mark, shared by messages, reactions, presence and "is typing" beats). Mind how khatru's limiter works:
// it does not refill little by little; it counts events per IP up to a maximum and frees a whole chunk once a minute, at the same
// instant for everybody. So once the allowance is spent it can take up to a minute to come back, and the client:
//  · keeps its own token bucket a bit under that limit, so it does not run into it by itself;
//  · gives each kind of event a priority: messages and reactions matter and wait for a free slot; presence beats may be skipped when
//    the bucket is low; "is typing" beats go first to the bin (they are cosmetic);
//  · retries a message by itself, with growing pauses over a bit more than a minute, when the relay still answers "rate-limited"
//    (other tabs or people behind the same IP spend the same budget); the UI is told on every wait so it can say so.
export type Priority = 'high' | 'mid' | 'low'
export interface Result { ok: boolean; reason: string }

/** Tokens that must be left in the bucket for an event of each priority to be sent (low-priority ones are skipped otherwise). */
export const RESERVE: Record<Priority, number> = { high: 1, mid: 3, low: 10 }
export const RATE_LIMITED = /rate[- ]?limit|slow down|too many/i

export interface OutboxOptions {
  capacity?: number // tokens in a full bucket (default 40: under the relay's burst of 60)
  perSecond?: number // refill speed (default 0.4/s = 24/min: under the relay's 30/min)
  now?: () => number // ms
  sleep?: (ms: number) => Promise<void>
  retryDelays?: number[] // pauses before each retry of a high-priority event (default: 2+4+8+16+32 s = 62 s, longer than the relay's minute)
  maxWaitMs?: number // how long a high-priority event may wait for a free slot
}

export class Outbox {
  private tokens: number
  private last: number
  private readonly capacity: number
  private readonly perSecond: number
  private readonly now: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly retryDelays: number[]
  private readonly maxWaitMs: number

  constructor(o: OutboxOptions = {}) {
    this.capacity = o.capacity ?? 40
    this.perSecond = o.perSecond ?? 0.4
    this.now = o.now ?? Date.now
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
    this.retryDelays = o.retryDelays ?? [2000, 4000, 8000, 16000, 32000]
    this.maxWaitMs = o.maxWaitMs ?? 15000
    this.tokens = this.capacity
    this.last = this.now()
  }

  /** Tokens available right now. */
  available(): number {
    const t = this.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((t - this.last) / 1000) * this.perSecond)
    this.last = t
    return this.tokens
  }

  /**
   * Sends one event through `publish`. Low/mid-priority events are skipped (`reason: 'skipped'`, nothing sent) when the bucket is low.
   * High-priority ones wait for a slot and are retried when the relay says it is rate-limited.
   */
  async send(priority: Priority, publish: () => Promise<Result>, onWait?: () => void): Promise<Result> {
    if (priority !== 'high') {
      if (this.available() < RESERVE[priority]) return { ok: false, reason: 'skipped' }
      this.tokens -= 1
      return publish()
    }
    for (let attempt = 0; ; attempt++) {
      if (!(await this.waitForSlot())) return { ok: false, reason: 'rate-limited: waited too long for a free slot' }
      this.tokens -= 1
      const r = await publish()
      if (r.ok || !RATE_LIMITED.test(r.reason) || attempt >= this.retryDelays.length) return r
      onWait?.()
      await this.sleep(this.retryDelays[attempt])
    }
  }

  private async waitForSlot(): Promise<boolean> {
    const start = this.now()
    while (this.available() < RESERVE.high) {
      if (this.now() - start >= this.maxWaitMs) return false
      await this.sleep(250)
    }
    return true
  }
}

/** True for relay answers that mean "you are sending too fast". */
export const isRateLimited = (reason: string) => RATE_LIMITED.test(reason)
