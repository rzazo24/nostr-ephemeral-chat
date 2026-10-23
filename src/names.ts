// Random names and rooms. The nickname comes from the public key, so everybody sees the same one for the same identity.
const ADJ = ['quick', 'calm', 'curious', 'brave', 'serene', 'happy', 'clever', 'bright', 'swift', 'subtle', 'warm', 'agile', 'bold', 'lunar', 'solar', 'green']
const ANIMAL = ['fox', 'owl', 'dolphin', 'lynx', 'cat', 'raven', 'bear', 'wolf', 'otter', 'hawk', 'deer', 'octopus', 'tiger', 'panda', 'koala', 'hedgehog']

export function nickFromPubkey(pubkey: string): string {
  const a = parseInt(pubkey.slice(0, 4), 16)
  const b = parseInt(pubkey.slice(4, 8), 16)
  const n = parseInt(pubkey.slice(8, 10), 16) % 100
  return `${ADJ[a % ADJ.length]}-${ANIMAL[b % ANIMAL.length]}-${n}`
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // no look-alike characters (l, o, 0, 1)

/**
 * A readable name for a room, like "kfm-7xq-d4p": three groups of three characters, easy to read out loud. It is derived from the
 * room's public topic hash (never from the secret room id), so everybody in the room sees the same one. It deliberately looks
 * nothing like the word-based nicknames of people.
 */
export function roomNameFromTopic(topic: string): string {
  let out = ''
  for (let i = 0; i < 9; i++) {
    out += ALPHABET[parseInt(topic.slice(i * 2, i * 2 + 2), 16) % ALPHABET.length]
    if (i === 2 || i === 5) out += '-'
  }
  return out
}
/** How long a room keeps its messages: 0 = nothing is stored (the default), or 24 h / 7 days. It is chosen when the room is
 *  created and travels in the link as a suffix of the room id ("…-24h", "…-7d"). The topic and the key are derived from the whole id,
 *  so editing the suffix does not change a room's rules: it opens a different room. */
export type Keep = 0 | 86400 | 604800
const SUFFIX: Record<Keep, string> = { 0: '', 86400: '-24h', 604800: '-7d' }

/** Room id: 16 characters (80 bits), plus the keep suffix. It is also the encryption secret, so it must not be guessable. */
export function randomRoomId(keep: Keep = 0): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('') + SUFFIX[keep]
}

export const validRoomId = (s: string) => /^[a-z0-9]{8,64}(-24h|-7d)?$/.test(s)
export const keepOf = (roomId: string): Keep => (roomId.endsWith('-24h') ? 86400 : roomId.endsWith('-7d') ? 604800 : 0)
