// Who is in the room: the relay stores nothing, so it is inferred from heartbeats (kind 20002) and recent messages.
export const PRESENCE_EVERY_MS = 30_000
export const ONLINE_FOR_MS = 75_000

export class Roster {
  private seen = new Map<string, number>()
  constructor(private now: () => number = Date.now) {}

  /** Records a sign of life from `pubkey`. Returns true if it is the first time we see it (or it was gone and came back). */
  touch(pubkey: string): boolean {
    const prev = this.seen.get(pubkey)
    this.seen.set(pubkey, this.now())
    return prev === undefined || this.now() - prev > ONLINE_FOR_MS
  }
  leave(pubkey: string) { this.seen.delete(pubkey) }
  online(): string[] {
    const limit = this.now() - ONLINE_FOR_MS
    for (const [k, t] of this.seen) if (t < limit) this.seen.delete(k)
    return [...this.seen.keys()]
  }
}
