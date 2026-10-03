// Minimal single-relay client: one subscription, publishing, and automatic reconnection.
import type { Event, Filter } from 'nostr-tools'

export interface RelayClient {
  publish(ev: Event): Promise<{ ok: boolean; reason: string }>
  close(): void
}

export function connectRelay(opts: {
  url: string
  filter: Filter
  onEvent: (ev: Event) => void
  onStatus: (s: 'connecting' | 'open' | 'closed') => void
}): RelayClient {
  let ws: WebSocket | null = null
  let closed = false
  let retry = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const waiting = new Map<string, (r: { ok: boolean; reason: string }) => void>()

  const open = () => {
    if (closed) return
    opts.onStatus('connecting')
    const sock = new WebSocket(opts.url)
    ws = sock
    sock.onopen = () => {
      retry = 0
      opts.onStatus('open')
      sock.send(JSON.stringify(['REQ', 'sala', opts.filter]))
    }
    sock.onmessage = (m) => {
      let msg: unknown[]
      try { msg = JSON.parse(String(m.data)) } catch { return }
      if (msg[0] === 'EVENT' && msg[2]) opts.onEvent(msg[2] as Event)
      else if (msg[0] === 'OK') { waiting.get(String(msg[1]))?.({ ok: msg[2] === true, reason: String(msg[3] ?? '') }); waiting.delete(String(msg[1])) }
    }
    sock.onclose = () => {
      if (ws !== sock) return
      opts.onStatus('closed')
      for (const f of waiting.values()) f({ ok: false, reason: 'connection lost' })
      waiting.clear()
      if (!closed) timer = setTimeout(open, Math.min(1000 * 2 ** retry++, 8000))
    }
    sock.onerror = () => {} // the following 'close' retries
  }
  open()

  // When the tab comes back (mobile) reconnect right away instead of waiting for the timer.
  const wake = () => { if (!closed && (!ws || ws.readyState > 1)) { clearTimeout(timer); retry = 0; open() } }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && wake())
    window.addEventListener('online', wake)
  }

  return {
    publish(ev) {
      return new Promise((resolve) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, reason: 'not connected' })
        const t = setTimeout(() => { waiting.delete(ev.id); resolve({ ok: false, reason: 'no answer from the relay' }) }, 8000)
        waiting.set(ev.id, (r) => { clearTimeout(t); resolve(r) })
        ws.send(JSON.stringify(['EVENT', ev]))
      })
    },
    close() { closed = true; clearTimeout(timer); ws?.close() },
  }
}
