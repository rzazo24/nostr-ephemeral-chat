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
/** Room id: 16 characters (80 bits). It is also the encryption secret, so it must not be guessable. */
export function randomRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export const validRoomId = (s: string) => /^[a-z0-9]{8,64}$/.test(s)
