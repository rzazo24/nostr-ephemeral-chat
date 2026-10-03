# Ephemeral chat for Nostr

*Leer en español: [README.es.md](README.es.md)*

**Live: https://chat.hivescope.xyz**

A tiny web chat on top of a Nostr relay. Every time you open it, you get **a brand-new random room** and **a brand-new identity**. Share the link and whoever opens it is in the same room. Nothing is stored: close the tab and it is gone.

It connects to `wss://relay.hivescope.xyz` by default (any relay that accepts ephemeral events works).

## How it works

- **Ephemeral events** (kinds 20000–29999): relays forward them to whoever is subscribed and never store them.
  - `20001` — chat message
  - `20002` — join / heartbeat (every 30 s; a `["bye"]` tag when leaving). This is how the "who is here" list works, since there is no history to ask.
- **Identity**: a fresh secp256k1 key on every visit, kept in memory only. The nickname (e.g. `calm-otter-42`) is derived from the public key, so everybody sees the same one.
- **Room**: a random 80-bit id in the URL fragment (`#…`), which browsers never send to any server.
- **Privacy**: the room id derives (HKDF) an AES-GCM key. Message contents are encrypted with it, and the room tag published to the relay is a SHA-256 hash of the id. The relay operator sees who talks when and how much, but not what, and cannot join a room without the link. It is *not* a substitute for a vetted end-to-end protocol: anyone with the link can read and write, and there is no forward secrecy.
- **Relay**: the deployed build is pinned to one relay (`VITE_RELAY`, default `wss://relay.hivescope.xyz`), which allows a strict CSP. In development, or when built with `VITE_ALLOW_CUSTOM_RELAY=1`, you can pick another with `?relay=wss://…` or from the footer.
- **Languages**: English and Spanish, switch in the header. Defaults to the browser language.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (+ end-to-end if RELAY_URL is set)
RELAY_URL=wss://relay.hivescope.xyz npm test
npm run build      # static site in dist/
```

The build is a static site: serve `dist/` from anywhere over HTTPS (needed for the clipboard button and `wss://`).

### Deploy next to a relay (Caddy)

`scripts/deploy.sh` publishes the chat through the Caddy of a [nostr-relay-khatru](https://github.com/rzazo24/nostr-relay-khatru) deployment, with a strict CSP (`deploy/chat.caddy.template`):

```bash
./scripts/deploy.sh ~/path/to/nostr-relay-khatru chat.example.com wss://relay.example.com
```

It needs a DNS record for the chat domain pointing at the server, and the relay repo's Caddyfile to `import /etc/caddy/sites/*.caddy` with `./sites` mounted (already the case in recent versions).

## Layout

| File | What it does |
|---|---|
| `src/chat.ts` | Room protocol: identity, publishing, subscription, presence |
| `src/crypto.ts` | Room topic hash and AES-GCM encryption |
| `src/relay.ts` | Minimal single-relay WebSocket client with reconnection |
| `src/roster.ts` | Who is online, from heartbeats |
| `src/names.ts` | Random room ids and nicknames |
| `src/i18n.ts` | English / Spanish texts |
| `src/main.ts` | UI |

## Known limits

- A relay may rate-limit ephemeral events per IP; a rejected message is shown in the chat.
- If nobody else is connected, a message reaches nobody (and some relays answer `mute: no one was listening`; this app always listens to its own room, so it does not trigger that).
- Whoever has the link can read everything written *while they are connected*; nothing is replayed to late joiners.

## License

MIT
