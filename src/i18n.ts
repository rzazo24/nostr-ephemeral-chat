// Two languages, English first. The choice is remembered in this browser; the default follows the browser language.
const KEY = 'chat-lang'
export type Lang = 'en' | 'es'

const ES = {
  'Ephemeral chat': 'Chat efímero',
  'connecting…': 'conectando…',
  'connected': 'conectado',
  'offline, retrying…': 'sin conexión, reintentando…',
  'You:': 'Tú:',
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
