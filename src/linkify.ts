// Turns the URLs in a message into links. Only http(s) is accepted, and the result is handed back as parts so the caller
// builds DOM nodes (text nodes + <a>): nothing is ever parsed as HTML.
export type Part = { text: string; url?: string }

const URL_RE = /https?:\/\/[^\s<>"']+/gi
const MAX_URL = 2000

/** Trailing punctuation is not part of the link; a closing ")" only is if the URL has the matching "(". */
function trimUrl(raw: string): string {
  let u = raw
  for (;;) {
    const last = u[u.length - 1]
    if (last && '.,;:!?'.includes(last)) u = u.slice(0, -1)
    else if ((last === ')' || last === ']') && count(u, last) > count(u, last === ')' ? '(' : '[')) u = u.slice(0, -1)
    else return u
  }
}
const count = (s: string, ch: string) => s.split(ch).length - 1

export function splitLinks(input: string): Part[] {
  const parts: Part[] = []
  let at = 0
  for (const m of input.matchAll(URL_RE)) {
    const url = trimUrl(m[0])
    let ok = url.length <= MAX_URL
    if (ok) { try { ok = /^https?:$/.test(new URL(url).protocol) } catch { ok = false } }
    if (!ok) continue
    if (m.index! > at) parts.push({ text: input.slice(at, m.index) })
    parts.push({ text: url, url })
    at = m.index! + url.length
  }
  if (at < input.length) parts.push({ text: input.slice(at) })
  return parts
}
