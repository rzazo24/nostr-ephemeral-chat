// Reactions to messages. Like everything here they are ephemeral: only people connected when a reaction is sent see it.
// A closed list keeps the protocol (and the screen) simple: anything else is ignored.
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const
export type Reaction = (typeof REACTIONS)[number]
export const isReaction = (s: unknown): s is Reaction => typeof s === 'string' && (REACTIONS as readonly string[]).includes(s)

const MAX_TRACKED_MESSAGES = 1000

export interface ReactionCount { emoji: Reaction; count: number; mine: boolean }

export class Reactions {
  private byMessage = new Map<string, Map<Reaction, Set<string>>>()

  /** Adds (`on`) or removes a reaction. Returns true if anything changed. */
  apply(messageId: string, emoji: Reaction, pubkey: string, on: boolean): boolean {
    let perEmoji = this.byMessage.get(messageId)
    if (!perEmoji) {
      if (!on) return false
      perEmoji = new Map()
      this.byMessage.set(messageId, perEmoji)
      if (this.byMessage.size > MAX_TRACKED_MESSAGES) this.byMessage.delete(this.byMessage.keys().next().value!)
    }
    let who = perEmoji.get(emoji)
    if (on) {
      if (!who) perEmoji.set(emoji, (who = new Set()))
      if (who.has(pubkey)) return false
      who.add(pubkey)
      return true
    }
    if (!who || !who.delete(pubkey)) return false
    if (!who.size) perEmoji.delete(emoji)
    return true
  }

  /** Reactions of a message in the fixed order of REACTIONS. */
  summary(messageId: string, me: string): ReactionCount[] {
    const perEmoji = this.byMessage.get(messageId)
    if (!perEmoji) return []
    return REACTIONS.filter((e) => perEmoji.get(e)?.size).map((emoji) => ({ emoji, count: perEmoji.get(emoji)!.size, mine: perEmoji.get(emoji)!.has(me) }))
  }
}
