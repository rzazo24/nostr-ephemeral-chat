// Two languages, English first. The choice is remembered in this browser; the default follows the browser language.
const KEY = 'chat-lang'
export type Lang = 'en' | 'es'

export const ES = {
  'Ephemeral chat': 'Chat efímero',
  'connecting…': 'conectando…',
  'connected': 'conectado',
  'reconnecting…': 'reconectando…',
  'You:': 'Tú:',
  "Help": "Ayuda",
  "Close": "Cerrar",
  "How it works": "Cómo funciona",
  "Every time you open the chat you get a brand-new random room and a brand-new identity (a random name like calm-otter-42).": "Cada vez que abres el chat tienes una sala aleatoria nueva y una identidad nueva (un nombre aleatorio como calm-otter-42).",
  "Copy the link with “Copy link” and send it to whoever you want: everyone who opens it is in the same room.": "Copia el enlace con «Copiar enlace» y envíaselo a quien quieras: todos los que lo abran estarán en la misma sala.",
  "“New room” leaves this room and starts another one with a different link. It asks first whether the new room keeps its messages: ephemeral (nothing is stored, the default), 24 hours or 7 days.": "«Sala nueva» sale de esta sala y empieza otra con un enlace distinto. Antes te pregunta si la sala nueva guarda sus mensajes: efímera (no se guarda nada, la opción por defecto), 24 horas o 7 días.",
  "The room has a short name (like kfm-7xq-d4p) that everyone in it sees. It is only a label: what gives access is the link.": "La sala tiene un nombre corto (como kfm-7xq-d4p) que ven todos los que están en ella. Es solo una etiqueta: lo que da acceso es el enlace.",
  "Privacy": "Privacidad",
  "Messages are encrypted with a key that lives in the part of the link after the #. Browsers never send that part to any server, so the relay only sees scrambled text.": "Los mensajes se cifran con una clave que va en la parte del enlace después de la #. Los navegadores nunca envían esa parte a ningún servidor, así que el relé solo ve texto ilegible.",
  "The relay can still see that someone is connected, when they write and how much, but not what.": "El relé sí puede ver que alguien está conectado, cuándo escribe y cuánto, pero no qué.",
  "Anyone who has the link can read and write in the room (and, in a room that keeps its messages, read everything still stored), so share it only with people you trust. There is no way to remove someone: start a new room instead.": "Cualquiera que tenga el enlace puede leer y escribir en la sala (y, en una sala que guarda sus mensajes, leer todo lo que siga guardado), así que compártelo solo con gente de confianza. No se puede echar a nadie: empieza una sala nueva.",
  "History": "Historial",
  "In an ephemeral room (the default) there is no history: you only see what is written while you are connected, and whoever joins later sees nothing from before.": "En una sala efímera (la opción por defecto) no hay historial: solo ves lo que se escribe mientras estás conectado, y quien entra después no ve nada de lo anterior.",
  "Closing or reloading the tab gives you a new identity. Reloading keeps the room, because the room is in the link. In a room that keeps its messages, what you wrote before stays, under your previous name.": "Cerrar o recargar la pestaña te da una identidad nueva. Recargar mantiene la sala, porque la sala va en el enlace. En una sala que guarda sus mensajes, lo que escribiste antes se queda, con tu nombre anterior.",
  "Reactions and emojis": "Reacciones y emojis",
  "Press ☺+ under a message to react with 👍 ❤️ 😂 😮 😢 or 🙏. Press your own reaction again to remove it. Reactions are kept exactly like the room’s messages: not at all in an ephemeral room, until they expire in one that keeps them.": "Pulsa ☺+ bajo un mensaje para reaccionar con 👍 ❤️ 😂 😮 😢 o 🙏. Vuelve a pulsar tu reacción para quitarla. Las reacciones se guardan igual que los mensajes de la sala: nada en una sala efímera, y hasta que caducan en una que los guarda.",
  "On a computer, the 😊 button next to the message box opens an emoji picker. On a phone, use your keyboard’s emojis.": "En un ordenador, el botón 😊 junto a la caja de texto abre un selector de emojis. En el móvil, usa los emojis de tu teclado.",
  "If something fails": "Si algo falla",
  "If the status shows “reconnecting…”, the chat reconnects by itself. Messages written meanwhile are not sent.": "Si el estado dice «reconectando…», el chat se reconecta solo. Los mensajes escritos mientras tanto no se envían.",
  "The relay limits how fast you can send. If a message is rejected, the reason appears in the chat; wait a few seconds and try again.": "El relé limita la velocidad de envío. Si un mensaje se rechaza, el motivo aparece en el chat; espera unos segundos y vuelve a intentarlo.",
  'Room:': 'Sala:',
  "Use “Share” (phones) or “QR code” to pass the link to someone next to you.": "Usa «Compartir» (móviles) o «Código QR» para pasarle el enlace a alguien que tengas al lado.",
  "Notifications, links and typing": "Notificaciones, enlaces y escritura",
  "The bell turns on a sound and, if your browser allows it, a notification when a message arrives while you are on another tab. Notifications never include the message text. The tab title always shows how many messages you have not seen.": "La campana activa un sonido y, si tu navegador lo permite, una notificación cuando llega un mensaje mientras estás en otra pestaña. Las notificaciones nunca incluyen el texto del mensaje. El título de la pestaña siempre muestra cuántos mensajes no has visto.",
  "Links in messages are clickable and open in a new tab. Check where they lead before opening them.": "Los enlaces de los mensajes se pueden pulsar y se abren en una pestaña nueva. Comprueba adónde llevan antes de abrirlos.",
  "You can see when someone is typing just above the message box.": "Verás cuándo alguien está escribiendo justo encima de la caja de mensajes.",
  "Notifications": "Notificaciones",
  "Share": "Compartir",
  "QR code": "Código QR",
  "Scan it to join this room. Show it only to people next to you.": "Escanéalo para entrar en esta sala. Enséñalo solo a quien tengas al lado.",
  "{names} is typing…": "{names} está escribiendo…",
  "{names} are typing…": "{names} están escribiendo…",
  "Several people are typing…": "Varias personas están escribiendo…",
  "New message in {room}": "Mensaje nuevo en {room}",
  "New message from {nick}": "Mensaje nuevo de {nick}",
  "Notifications on: you will hear a sound and see a counter in the tab title when you are away.": "Notificaciones activadas: oirás un sonido y verás un contador en el título de la pestaña cuando estés en otra.",
  "Notifications are blocked in this browser, so only the sound and the counter will work.": "Las notificaciones están bloqueadas en este navegador, así que solo funcionarán el sonido y el contador.",
  "Notifications off.": "Notificaciones desactivadas.",
  "Install app": "Instalar app",
  "Install as an app": "Instalar como app",
  "On iPhone: open the chat in Safari, tap Share and then “Add to Home Screen”. On Android and desktop Chrome or Edge, use the “Install app” button or the browser’s install option. Each time you open the app you get a new room and a new identity. Notifications on a phone only work in the installed app, and only while it is still running in the background: nothing is pushed to a closed app.": "En iPhone: abre el chat en Safari, pulsa Compartir y luego «Añadir a pantalla de inicio». En Android y en Chrome o Edge de escritorio, usa el botón «Instalar app» o la opción de instalar del navegador. Cada vez que abres la app tienes una sala nueva y una identidad nueva. En el móvil las notificaciones solo funcionan en la app instalada, y solo mientras siga en segundo plano: no se envía nada a una app cerrada.",
  "A new version is available. Reloading keeps the room, but you get a new identity.": "Hay una versión nueva. Al recargar sigues en la sala, pero con una identidad nueva.",
  "Reload": "Recargar",
  "Later": "Más tarde",
  'About': 'Acerca de',
  "Sending…": "Enviando…",
  "The relay is limiting how fast you can send. Wait a minute and try again.": "El relé está limitando la velocidad de envío. Espera un minuto y vuelve a intentarlo.",
  "Waiting for the relay…": "Esperando al relé…",
  "On a computer, Enter sends and Shift+Enter adds a new line. On a phone, Enter adds a new line and the Send button sends. A message can have up to 1000 characters.": "En un ordenador, Intro envía y Mayús+Intro añade una línea. En el móvil, Intro añade una línea y el botón Enviar envía. Un mensaje puede tener hasta 1000 caracteres.",
  "If the relay says you are sending too fast, the message waits (dimmed, “Waiting for the relay…”) and is retried by itself for about a minute before giving up.": "Si el relé dice que envías demasiado rápido, el mensaje espera (atenuado, «Esperando al relé…») y se reintenta solo durante cerca de un minuto antes de rendirse.",
  'Emoji': 'Emojis',
  'React': 'Reaccionar',
  'In the room: {n}': 'En la sala: {n}',
  '(you)': '(tú)',
  'Source code': 'Código fuente',
  'Copy link': 'Copiar enlace',
  'Copied!': '¡Copiado!',
  'Copy the link:': 'Copia el enlace:',
  'New room': 'Sala nueva',
  'Type a message…': 'Escribe un mensaje…',
  'Send': 'Enviar',
  "By default nothing is stored: messages are only seen by whoever is in the room right now. Every visit creates a new identity.": "Por defecto no se guarda nada: los mensajes solo los ve quien está en la sala en ese momento. Cada visita crea una identidad nueva.",
  'Relay:': 'Relé:',
  'Change relay': 'Cambiar de relé',
  'Relay address (wss://…). A new room will open on it:': 'Dirección del relé (wss://…). Se abrirá una sala nueva en él:',
  'Ephemeral: nothing is stored': 'Efímera: no se guarda nada',
  'Keep messages 24 hours': 'Guardar mensajes 24 horas',
  'Keep messages 7 days': 'Guardar mensajes 7 días',
  'history: {time}': 'historial: {time}',
  '24 hours': '24 horas',
  '7 days': '7 días',
  'You joined a room. Messages from the last {time} are shown above.': 'Has entrado en una sala. Arriba tienes los mensajes de las últimas {time}.',
  'This room keeps its messages for {time}: anyone with the link can read them until they expire.': 'Esta sala guarda sus mensajes {time}: cualquiera con el enlace puede leerlos hasta que caduquen.',
  "A room created to keep its messages (24 hours or 7 days) says so next to its name, and its link ends in -24h or -7d. Whoever opens the link later reads what is still there: each message expires 24 hours or 7 days after it was sent. The relay stores them encrypted and deletes them when they expire; they cannot be deleted before.": "Una sala creada para guardar sus mensajes (24 horas o 7 días) lo indica junto a su nombre, y su enlace acaba en -24h o -7d. Quien abra el enlace después lee lo que siga ahí: cada mensaje caduca 24 horas o 7 días después de enviarse. El relé los guarda cifrados y los borra al caducar; no se pueden borrar antes.",
  'New room. Copy the link and send it to whoever you like.': 'Sala nueva. Copia el enlace y pásalo a quien quieras.',
  'You joined a room. You will only see what is written from now on.': 'Has entrado en una sala. Solo verás lo que se escriba desde ahora.',
  'Whoever joins later will not see what came before: nothing is stored.': 'Quien entre después no verá lo anterior: no se guarda nada.',
  'Not sent: {reason}': 'No se ha enviado: {reason}',
  'connection lost': 'conexión perdida',
  'not connected': 'sin conexión',
  'no answer from the relay': 'sin respuesta del relé',
  'the relay rejected it': 'el relé lo ha rechazado',
} as const

export type Phrase = keyof typeof ES

let lang: Lang = (() => {
  try { const s = localStorage.getItem(KEY); if (s === 'en' || s === 'es') return s } catch { /* no storage */ }
  return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'
})()

export const getLang = () => lang
export function setLang(next: Lang) {
  lang = next
  try { localStorage.setItem(KEY, next) } catch { /* not remembered */ }
}

/** Translate a phrase (English is the source text). `{name}` placeholders are filled from `vars`. */
export function t(en: Phrase, vars?: Record<string, string>): string {
  const s: string = lang === 'es' ? ES[en] : en
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`) : s
}
