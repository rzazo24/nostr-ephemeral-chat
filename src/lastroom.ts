// The last room that keeps its messages, remembered on this device only, so the installed app (which always opens a new room) can
// offer to go back to it. Ephemeral rooms are never remembered: there would be nothing to go back to. It lasts as long as what you
// last saw there can still be stored: `keep` seconds after your last visit.
import { keepOf, validRoomId } from './names'

const KEY = 'chat-last-kept-room'
export interface LastRoom { id: string; name: string; seenAt: number }

export function rememberRoom(id: string, name: string, now = Date.now()): void {
  if (!keepOf(id)) return
  try { localStorage.setItem(KEY, JSON.stringify({ id, name, seenAt: now })) } catch { /* not remembered */ }
}

export function lastRoom(now = Date.now()): LastRoom | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<LastRoom> | null
    if (!r || typeof r.id !== 'string' || !validRoomId(r.id) || typeof r.name !== 'string' || typeof r.seenAt !== 'number') return null
    if (now > r.seenAt + keepOf(r.id) * 1000) { forgetRoom(); return null } // everything in it has expired by now
    return { id: r.id, name: r.name, seenAt: r.seenAt }
  } catch { return null }
}

export function forgetRoom(): void {
  try { localStorage.removeItem(KEY) } catch { /* nothing to forget */ }
}
