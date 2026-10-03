// Room encryption: the room id (which only travels in the URL fragment, never to a server) derives two things:
//  · `topic`: what is published as the room tag. It is a hash and does not reveal the id.
//  · the AES-GCM key every message is encrypted with. The relay only ever sees ciphertext.
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const hex = (u: Uint8Array) => Array.from(u, (b) => b.toString(16).padStart(2, '0')).join('')

export async function topicOf(roomId: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('topic:' + roomId))
  return hex(new Uint8Array(h)).slice(0, 32)
}

export async function roomKey(roomId: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(roomId), 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode('nostr-chat-efimero'), info: enc.encode('msg-v1') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  )
}

export async function encrypt(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv); out.set(ct, iv.length)
  return b64(out)
}

/** Returns the text, or null if it cannot be decrypted (other room, garbage, tampered). */
export async function decrypt(key: CryptoKey, payload: string): Promise<string | null> {
  try {
    const raw = unb64(payload)
    if (raw.length < 13) return null
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))
    return dec.decode(pt)
  } catch { return null }
}
