// Two languages, English first. The choice is remembered in this browser; the default follows the browser language.
const KEY = 'chat-lang'
export type Lang = 'en' | 'es'

export const ES = {
  'Ephemeral chat': 'Chat efímero',
  'connecting…': 'conectando…',
  'connected': 'conectado',
  'offline, retrying…': 'sin conexión, reintentando…',
  'You:': 'Tú:',
  "Help": "Ayuda",
  "Close": "Cerrar",
  "How it works": "Cómo funciona",
  "Every time you open the chat you get a brand-new random room and a brand-new identity (a random name like calm-otter-42).": "Cada vez que abres el chat tienes una sala aleatoria nueva y una identidad nueva (un nombre aleatorio como calm-otter-42).",
  "Copy the link with “Copy link” and send it to whoever you want: everyone who opens it is in the same room.": "Copia el enlace con «Copiar enlace» y envíaselo a quien quieras: todos los que lo abran estarán en la misma sala.",
  "“New room” leaves this room and starts another one with a different link.": "«Sala nueva» sale de esta sala y empieza otra con un enlace distinto.",
  "Privacy": "Privacidad",
  "Messages are encrypted with a key that lives in the part of the link after the #. Browsers never send that part to any server, so the relay only sees scrambled text.": "Los mensajes se cifran con una clave que va en la parte del enlace después de la #. Los navegadores nunca envían esa parte a ningún servidor, así que el relé solo ve texto ilegible.",
  "The relay can still see that someone is connected, when they write and how much, but not what.": "El relé sí puede ver que alguien está conectado, cuándo escribe y cuánto, pero no qué.",
  "Anyone who has the link can read and write in the room, so share it only with people you trust. There is no way to remove someone: start a new room instead.": "Cualquiera que tenga el enlace puede leer y escribir en la sala, así que compártelo solo con gente de confianza. No se puede echar a nadie: empieza una sala nueva.",
  "Nothing is stored": "No se guarda nada",
  "There is no history. You only see what is written while you are connected, and whoever joins later sees nothing from before.": "No hay historial. Solo ves lo que se escribe mientras estás conectado, y quien entra después no ve nada de lo anterior.",
  "Closing or reloading the tab gives you a new identity. Reloading keeps the room, because the room is in the link.": "Cerrar o recargar la pestaña te da una identidad nueva. Recargar mantiene la sala, porque la sala va en el enlace.",
  "Reactions and emojis": "Reacciones y emojis",
  "Press ☺+ under a message to react with 👍 ❤️ 😂 😮 😢 or 🙏. Press your own reaction again to remove it. Like messages, reactions are not stored.": "Pulsa ☺+ bajo un mensaje para reaccionar con 👍 ❤️ 😂 😮 😢 o 🙏. Vuelve a pulsar tu reacción para quitarla. Igual que los mensajes, las reacciones no se guardan.",
  "On a computer, the 😊 button next to the message box opens an emoji picker. On a phone, use your keyboard’s emojis.": "En un ordenador, el botón 😊 junto a la caja de texto abre un selector de emojis. En el móvil, usa los emojis de tu teclado.",
  "If something fails": "Si algo falla",
  "If the status shows “offline”, the chat reconnects by itself. Messages written meanwhile are not sent.": "Si el estado dice «sin conexión», el chat se reconecta solo. Los mensajes escritos mientras tanto no se envían.",
  "The relay limits how fast you can send. If a message is rejected, the reason appears in the chat; wait a few seconds and try again.": "El relé limita la velocidad de envío. Si un mensaje se rechaza, el motivo aparece en el chat; espera unos segundos y vuelve a intentarlo.",
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
  'No history: messages are only seen by whoever is in the room right now. Every visit creates a new identity.':
    'Sin historial: los mensajes solo los ve quien está en la sala ahora mismo. Cada visita crea una identidad nueva.',
  'Relay:': 'Relé:',
  'Change relay': 'Cambiar de relé',
  'Relay address (wss://…). A new room will open on it:': 'Dirección del relé (wss://…). Se abrirá una sala nueva en él:',
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
