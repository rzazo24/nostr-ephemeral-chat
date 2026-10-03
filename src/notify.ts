// "Bell": a short sound and, when the browser allows it, a system notification for messages that arrive while the tab is
// in the background. The unread counter in the page title is separate (main.ts) and always on. Off by default.
const KEY = 'chat-notify'
let ctx: AudioContext | undefined

export function isOn(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}

/** Turns the bell on/off. Returns the state in effect and whether system notifications were refused. */
export async function setOn(on: boolean): Promise<{ on: boolean; blocked: boolean }> {
  let blocked = false
  if (on) {
    try { ctx ??= new AudioContext(); await ctx.resume() } catch { /* no sound available */ }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* old browsers use a callback; ignore */ }
    }
    blocked = typeof Notification === 'undefined' || Notification.permission !== 'granted'
  }
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* not remembered */ }
  return { on, blocked }
}

function beep() {
  if (!ctx || ctx.state !== 'running') return
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = 'sine'; o.frequency.value = 880
  g.gain.setValueAtTime(0.0001, ctx.currentTime)
  g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
  o.connect(g).connect(ctx.destination)
  o.start(); o.stop(ctx.currentTime + 0.27)
}

/** Sound + notification. The notification never carries the message text (it would show on lock screens). */
export function ping(title: string, body: string) {
  beep()
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const opts = { body, tag: 'chat-message', silent: true }
  // Phones only allow notifications shown by a service worker (the constructor throws); desktop browsers allow both.
  const viaWorker = navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, opts))
  if (viaWorker) viaWorker.catch(() => { try { new Notification(title, opts) } catch { /* nothing else to try */ } })
  else { try { new Notification(title, opts) } catch { /* not allowed here */ } }
}
