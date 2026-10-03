# Chat efímero para Nostr

*Read in English: [README.md](README.md)*

**En vivo: https://chat.hivescope.xyz**

Un chat web diminuto sobre un relé de Nostr. Cada vez que lo abres tienes **una sala aleatoria nueva** y **una identidad nueva**. Compartes el enlace y quien lo abra está en la misma sala. No se guarda nada: cierras la pestaña y desaparece.

Se conecta por defecto a `wss://relay.hivescope.xyz` (vale cualquier relé que acepte eventos efímeros).

## Cómo funciona

- **Eventos efímeros** (kinds 20000–29999): los relés los reenvían a quien esté suscrito y nunca los guardan.
  - `20001` — mensaje de chat
  - `20002` — entrada / latido (cada 30 s; con un tag `["bye"]` al salir). Así funciona la lista de «quién está aquí», porque no hay historial al que preguntar.
- **Identidad**: una clave secp256k1 nueva en cada visita, solo en memoria. El apodo (p. ej. `calm-otter-42`) sale de la clave pública, así todos ven el mismo.
- **Sala**: un id aleatorio de 80 bits en el fragmento de la URL (`#…`), que los navegadores nunca envían a ningún servidor.
- **Privacidad**: del id de sala se deriva (HKDF) una clave AES-GCM con la que se cifra el contenido, y la etiqueta de sala que se publica en el relé es un hash SHA-256 del id. Quien administra el relé ve quién habla, cuándo y cuánto, pero no qué, y no puede entrar en una sala sin el enlace. **No** sustituye a un protocolo de cifrado extremo a extremo revisado: cualquiera con el enlace puede leer y escribir, y no hay secreto hacia delante.
- **Relé**: la versión desplegada va fijada a un relé (`VITE_RELAY`, por defecto `wss://relay.hivescope.xyz`), lo que permite una CSP estricta. En desarrollo, o compilando con `VITE_ALLOW_CUSTOM_RELAY=1`, puedes elegir otro con `?relay=wss://…` o desde el pie de página.
- **Idiomas**: inglés y español, con un botón en la cabecera. Por defecto, el del navegador.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas unitarias (+ extremo a extremo si defines RELAY_URL)
RELAY_URL=wss://relay.hivescope.xyz npm test
npm run build      # sitio estático en dist/
```

La compilación es un sitio estático: sirve `dist/` desde donde quieras, con HTTPS (hace falta para el botón de copiar y para `wss://`).

### Despliegue junto a un relé (Caddy)

`scripts/deploy.sh` publica el chat a través del Caddy de un despliegue de [nostr-relay-khatru](https://github.com/rzazo24/nostr-relay-khatru), con una CSP estricta (`deploy/chat.caddy.template`):

```bash
./scripts/deploy.sh ~/ruta/a/nostr-relay-khatru chat.ejemplo.com wss://relay.ejemplo.com
```

Necesita un registro DNS del dominio del chat hacia el servidor, y que el Caddyfile del repo del relé haga `import /etc/caddy/sites/*.caddy` con `./sites` montado (ya ocurre en las versiones recientes).

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/chat.ts` | Protocolo de la sala: identidad, publicar, suscripción, presencia |
| `src/crypto.ts` | Hash de la etiqueta de sala y cifrado AES-GCM |
| `src/relay.ts` | Cliente WebSocket mínimo de un relé, con reconexión |
| `src/roster.ts` | Quién está conectado, a partir de los latidos |
| `src/names.ts` | Ids de sala y apodos aleatorios |
| `src/i18n.ts` | Textos en inglés y español |
| `src/main.ts` | Interfaz |

## Límites conocidos

- Un relé puede limitar los eventos efímeros por IP; el mensaje rechazado se muestra en el chat.
- Si no hay nadie más conectado, el mensaje no llega a nadie (y algunos relés contestan `mute: no one was listening`; esta app siempre escucha su propia sala, así que no lo provoca).
- Quien tenga el enlace puede leer todo lo que se escriba *mientras esté conectado*; a quien llega tarde no se le reenvía nada.

## Licencia

MIT
