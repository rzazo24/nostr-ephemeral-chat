// What the browser tests need, without Docker or Caddy: the real relay binary (RELAY_BIN) and a small server that plays Caddy for the
// built app (`npm run build` → dist/): it serves the files with the SAME content-security policies as deploy/chat.caddy.template
// (read from there, so the two cannot drift apart). The policies matter: a bug that only showed up under the strict CSP (the
// service worker could not install) is exactly what these tests must catch.
//
// The built bundle points at the production relay; the server swaps that address for the test relay while serving it.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const here = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(here, '../..')
const dist = path.join(repoRoot, 'dist')
const PROD_RELAY = 'wss://relay.hivescope.xyz'
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)) })
})

/** The two policies of the Caddy template: the page's, and the one the service worker script is served with. */
function policies() {
  const tpl = fs.readFileSync(path.join(repoRoot, 'deploy/chat.caddy.template'), 'utf8')
  const page = tpl.match(/header @notsw Content-Security-Policy "([^"]+)"/)
  const sw = tpl.match(/header @sw Content-Security-Policy "([^"]+)"/)
  if (!page || !sw) throw new Error('could not find the CSP lines in deploy/chat.caddy.template')
  return { page: page[1], sw: sw[1] }
}

/**
 * A pretend relay for the rate-limit tests: it speaks just enough of the protocol (REQ → EOSE, EVENT → OK, and echoes accepted events to
 * every subscriber) and answers "rate-limited" to the first `rejectFirst` MESSAGES (kind 20001; Infinity: all of them). Presence beats and
 * reactions are always accepted, so the count is about the messages the test sends. Deterministic and instant,
 * unlike the real relay, which frees its allowance only once a minute.
 */
async function startStub({ rejectFirst = 0 } = {}) {
  const port = await freePort()
  const wss = new WebSocketServer({ host: '127.0.0.1', port })
  const subs = new Map() // socket -> subscription ids
  const stats = { messages: 0, rejected: 0, accepted: [] }
  wss.on('connection', (ws) => {
    subs.set(ws, new Set())
    ws.on('close', () => subs.delete(ws))
    ws.on('message', (raw) => {
      let m
      try { m = JSON.parse(String(raw)) } catch { return }
      if (m[0] === 'REQ') { subs.get(ws).add(m[1]); ws.send(JSON.stringify(['EOSE', m[1]])) }
      else if (m[0] === 'EVENT') {
        const ev = m[1]
        if (ev.kind === 20001) stats.messages++
        if (ev.kind === 20001 && stats.messages <= rejectFirst) { stats.rejected++; ws.send(JSON.stringify(['OK', ev.id, false, 'rate-limited: slow down, please'])); return }
        stats.accepted.push(ev)
        ws.send(JSON.stringify(['OK', ev.id, true, '']))
        for (const [sock, ids] of subs) for (const id of ids) sock.send(JSON.stringify(['EVENT', id, ev]))
      }
    })
  })
  return { relayWs: `ws://127.0.0.1:${port}`, stats, stop: () => new Promise((r) => { for (const c of wss.clients) c.terminate(); wss.close(() => r()) }) } // clients (open pages) are cut off, or close() would wait for them
}

/**
 * Starts a relay (or, with `{ stub }`, a pretend one: see startStub) and a server for the app.
 * `relayEnv` overrides relay settings (e.g. low rate limits). Returns { appUrl, relayWs, stub?, bumpVersion(), relayLog(), stop() }.
 */
export async function startStack(relayEnv = {}, { stub = null } = {}) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/ is missing: run `npm run build` first')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-e2e-'))
  const appPort = await freePort()
  let relay = null, stubRelay = null, relayWs, relayLog = ''
  if (stub) {
    stubRelay = await startStub(stub)
    relayWs = stubRelay.relayWs
  } else {
    const bin = process.env.RELAY_BIN ? path.resolve(process.env.RELAY_BIN) : path.resolve(repoRoot, '../nostr-relay-khatru/nostr-relay-khatru')
    if (!fs.existsSync(bin)) throw new Error(`relay binary not found (${bin}): build nostr-relay-khatru and set RELAY_BIN`)
    const relayPort = await freePort()
    relayWs = `ws://127.0.0.1:${relayPort}`
    relay = spawn(bin, [], {
      env: {
        ...process.env,
        RELAY_DB_PATH: path.join(dir, 'relay.sqlite'), RELAY_LISTEN_ADDR: `127.0.0.1:${relayPort}`,
        RELAY_EVENTS_PER_MINUTE: '1000000', RELAY_EVENTS_BURST: '1000000', RELAY_REQS_PER_MINUTE: '1000000', RELAY_REQS_BURST: '1000000',
        RELAY_CONNS_PER_MINUTE: '1000000', RELAY_CONNS_BURST: '1000000',
        ...relayEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    relay.stdout.on('data', (d) => { relayLog += d })
    relay.stderr.on('data', (d) => { relayLog += d })
  }

  const csp = policies()
  const pagePolicy = csp.page.replace('__RELAY__', relayWs)
  let swVersion = null // set by bumpVersion(): the service worker script then changes, like after a deploy

  const server = http.createServer((req, res) => {
    let f = req.url.split('?')[0]
    if (f === '/') f = '/index.html'
    const file = path.join(dist, f)
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return }
    const headers = {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': f.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': f === '/sw.js' ? csp.sw : pagePolicy, // sw.js has its own, as in the Caddy template
    }
    let body = fs.readFileSync(file)
    if (f.endsWith('.js') && f !== '/sw.js') body = Buffer.from(body.toString('utf8').replaceAll(PROD_RELAY, relayWs))
    if (f === '/sw.js' && swVersion) body = Buffer.from(body.toString('utf8').replace(/chat-[a-z0-9]+'/, `chat-${swVersion}'`))
    res.writeHead(200, headers)
    res.end(body)
  }).listen(appPort, '127.0.0.1')

  if (relay) {
    const http0 = relayWs.replace('ws://', 'http://')
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(http0, { headers: { Accept: 'application/nostr+json' } })).ok) break } catch { /* not yet */ }
      await new Promise((r) => setTimeout(r, 250))
      if (i === 59) throw new Error(`the relay did not start:\n${relayLog}`)
    }
  }

  return {
    appUrl: `http://127.0.0.1:${appPort}/`,
    relayWs,
    stub: stubRelay,
    /** From now on the server hands out a different sw.js, as if a new version had been deployed. */
    bumpVersion() { swVersion = Math.random().toString(36).slice(2, 10) },
    relayLog: () => relayLog,
    async stop() {
      server.close()
      relay?.kill()
      await stubRelay?.stop()
      await new Promise((r) => setTimeout(r, 200))
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}
