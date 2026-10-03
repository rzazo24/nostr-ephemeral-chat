// Who is typing right now. A "typing" beat is valid for a few seconds; a message from that person clears it at once.
export const TYPING_FOR_MS = 6000
export const TYPING_EVERY_MS = 4000

export class Typing {
  private at = new Map<string, number>()
  constructor(private now: () => number = Date.now) {}
  mark(pubkey: string) { this.at.set(pubkey, this.now()) }
  clear(pubkey: string) { this.at.delete(pubkey) }
  active(): string[] {
    const limit = this.now() - TYPING_FOR_MS
    for (const [k, t] of this.at) if (t < limit) this.at.delete(k)
    return [...this.at.keys()]
  }
}
