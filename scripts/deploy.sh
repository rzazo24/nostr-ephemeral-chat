#!/usr/bin/env bash
# Builds the chat and publishes it through the Caddy of a relay deployment (nostr-relay-khatru):
#
#   ./scripts/deploy.sh <path-to-relay-repo> <chat-domain> [relay-url]
#   ./scripts/deploy.sh ~/proyectos/nostr-relay-khatru chat.example.com wss://relay.example.com
#
# It copies dist/ to <relay-repo>/sites/chat/, writes <relay-repo>/sites/chat.caddy and reloads Caddy
# (the relay repo's Caddyfile must `import /etc/caddy/sites/*.caddy` and mount ./sites; see README).
set -euo pipefail
cd "$(dirname "$0")/.."

RELAY_REPO="${1:?usage: deploy.sh <path-to-relay-repo> <chat-domain> [relay-url]}"
DOMAIN="${2:?usage: deploy.sh <path-to-relay-repo> <chat-domain> [relay-url]}"
RELAY="${3:-wss://relay.hivescope.xyz}"
[[ "$RELAY" =~ ^wss://[A-Za-z0-9.:-]+$ ]] || { echo "relay-url must look like wss://host" >&2; exit 1; }
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "invalid domain" >&2; exit 1; }

VITE_RELAY="$RELAY" npm run build
mkdir -p "$RELAY_REPO/sites/chat"
rsync -a --delete dist/ "$RELAY_REPO/sites/chat/"
sed -e "s#__DOMAIN__#$DOMAIN#" -e "s#__RELAY__#$RELAY#" deploy/chat.caddy.template > "$RELAY_REPO/sites/chat.caddy"

cd "$RELAY_REPO"
docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
echo "published: https://$DOMAIN"
