# Chat efímero para Nostr

*Read in English: [README.md](README.md)*

**En vivo: https://chat.hivescope.xyz**

Chat efímero de Nostr: una sala aleatoria nueva y una identidad nueva en cada visita. Los mensajes se cifran con una clave derivada del enlace de la sala.

Un chat web diminuto sobre un relé de Nostr. Cada vez que lo abres tienes **una sala aleatoria nueva** y **una identidad nueva**. Compartes el enlace y quien lo abra está en la misma sala. No se guarda nada: cierras la pestaña y desaparece.

Se conecta por defecto a `wss://relay.hivescope.xyz` (vale cualquier relé que acepte eventos efímeros).

## Cómo funciona

- **Eventos efímeros** (kinds 20000–29999): los relés los reenvían a quien esté suscrito y nunca los guardan.
  - `20001` — mensaje de chat
  - `20003` — reacción a un mensaje (cifrado `{"e":"👍","on":true}` más un tag `["e", <id del mensaje>]`; `on:false` la quita). Lista cerrada: 👍 ❤️ 😂 😮 😢 🙏
  - `20002` — presencia: entrada / latido cada 30 s y avisos de «está escribiendo» (como máximo uno cada 4 s mientras escribes). Ambos contenidos van cifrados y miden lo mismo, así que el relé no los distingue; un tag `["bye"]` marca la salida. Así funciona la lista de «quién está aquí», porque no hay historial al que preguntar.
- **Identidad**: una clave secp256k1 nueva en cada visita, solo en memoria. El apodo (p. ej. `calm-otter-42`) sale de la clave pública, así todos ven el mismo.
- **Sala**: un id aleatorio de 80 bits en el fragmento de la URL (`#…`), que los navegadores nunca envían a ningún servidor.
- **Privacidad**: del id de sala se deriva (HKDF) una clave AES-GCM con la que se cifra el contenido, y la etiqueta de sala que se publica en el relé es un hash SHA-256 del id. Quien administra el relé ve quién habla, cuándo y cuánto, pero no qué, y no puede entrar en una sala sin el enlace. **No** sustituye a un protocolo de cifrado extremo a extremo revisado: cualquiera con el enlace puede leer y escribir, y no hay secreto hacia delante.
- **Relé**: la versión desplegada va fijada a un relé (`VITE_RELAY`, por defecto `wss://relay.hivescope.xyz`), lo que permite una CSP estricta. En desarrollo, o compilando con `VITE_ALLOW_CUSTOM_RELAY=1`, puedes elegir otro con `?relay=wss://…` o desde el pie de página.
- **Reacciones y emojis**: pulsa ☺+ bajo un mensaje para reaccionar; vuelve a pulsar tu reacción para quitarla. Quien llega tarde no ve las reacciones anteriores (no se guarda nada). En el PC hay un selector de emojis junto a la caja de texto; los dispositivos táctiles usan su propio teclado.
- **Notificaciones**: el título de la pestaña siempre muestra los mensajes sin leer. La campana (desactivada por defecto) añade un sonido y, si el navegador lo permite, una notificación del sistema; las notificaciones nunca llevan el texto del mensaje.
- **Compartir**: copiar el enlace, el menú de compartir del sistema (donde exista) o un código QR del enlace de la sala.
- Los **enlaces** de los mensajes se pueden pulsar (solo http/https, con `noopener` y sin referrer); y encima de la caja de texto se ve **«X está escribiendo…»**.
- **App instalable (PWA)**: manifiesto, iconos y un service worker que guarda la app en caché, así que abre sin conexión (el chat en sí necesita el relé). iPhone: Compartir → Añadir a pantalla de inicio; Android/escritorio: el botón «Instalar app». En el móvil las notificaciones solo funcionan en la app instalada y mientras siga en segundo plano: no hay servidor de push, así que nada llega a una app cerrada.
- **Idiomas y ayuda**: inglés y español, con un botón en la cabecera; el botón ? abre una ayuda. Por defecto, el del navegador.

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

Los iconos de `public/icons/` se generaron a partir de `public/icon.svg` y `icons-src/full-bleed.svg` (la versión a sangre usada en los iconos maskable y de Apple).

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/chat.ts` | Protocolo de la sala: identidad, publicar, suscripción, presencia |
| `src/crypto.ts` | Hash de la etiqueta de sala y cifrado AES-GCM |
| `src/relay.ts` | Cliente WebSocket mínimo de un relé, con reconexión |
| `src/reactions.ts` | Estado de las reacciones por mensaje (lista cerrada) |
| `src/emojis.ts` | Emojis del selector de escritorio |
| `src/roster.ts` | Quién está conectado, a partir de los latidos |
| `src/linkify.ts` | Detección segura de URLs en los mensajes |
| `src/typing.ts` | Quién está escribiendo ahora |
| `src/notify.ts` | Campana: sonido y notificaciones del sistema |
| `src/qr.ts` | Código QR del enlace de la sala |
| `public/sw.js`, `public/manifest.webmanifest` | PWA: service worker (con el nombre de caché sellado por `vite.config.ts` en cada build) y manifiesto |
| `src/names.ts` | Ids de sala y apodos aleatorios |
| `src/i18n.ts` | Textos en inglés y español |
| `src/main.ts` | Interfaz |

## Límites conocidos

- Un relé puede limitar los eventos efímeros por IP; el mensaje rechazado se muestra en el chat.
- Si no hay nadie más conectado, el mensaje no llega a nadie (y algunos relés contestan `mute: no one was listening`; esta app siempre escucha su propia sala, así que no lo provoca).
- Quien tenga el enlace puede leer todo lo que se escriba *mientras esté conectado*; a quien llega tarde no se le reenvía nada.

## Licencia

MIT
