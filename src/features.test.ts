import { describe, expect, it } from 'vitest'
import { splitLinks } from './linkify'
import { Typing, TYPING_FOR_MS } from './typing'

describe('splitLinks', () => {
  const urls = (s: string) => splitLinks(s).filter((p) => p.url).map((p) => p.url)
  it('finds links and keeps the text around them', () => {
    expect(splitLinks('mira https://example.com/a?b=1 vale')).toEqual([
      { text: 'mira ' }, { text: 'https://example.com/a?b=1', url: 'https://example.com/a?b=1' }, { text: ' vale' },
    ])
    expect(urls('http://a.com y https://b.org/x')).toEqual(['http://a.com', 'https://b.org/x'])
  })
  it('drops trailing punctuation but keeps balanced parentheses', () => {
    expect(urls('ver https://example.com/x.')).toEqual(['https://example.com/x'])
    expect(urls('(ver https://example.com/x)')).toEqual(['https://example.com/x'])
    expect(urls('https://en.wikipedia.org/wiki/Foo_(bar)')).toEqual(['https://en.wikipedia.org/wiki/Foo_(bar)'])
    expect(urls('¿has visto https://example.com/x?!')).toEqual(['https://example.com/x'])
  })
  it('never turns anything else into a link', () => {
    expect(urls('javascript:alert(1)')).toEqual([])
    expect(urls('data:text/html,<b>x</b> ftp://x.com')).toEqual([])
    expect(urls('https://')).toEqual([])
    expect(splitLinks('<script>alert(1)</script>')).toEqual([{ text: '<script>alert(1)</script>' }])
    expect(urls('https://a.com/' + 'x'.repeat(2100))).toEqual([])
  })
  it('plain text and empty input', () => {
    expect(splitLinks('hola')).toEqual([{ text: 'hola' }])
    expect(splitLinks('')).toEqual([])
  })
})

describe('Typing', () => {
  it('expires, clears and lists who is typing', () => {
    let now = 0
    const t = new Typing(() => now)
    t.mark('a'); now += 1000; t.mark('b')
    expect(t.active().sort()).toEqual(['a', 'b'])
    now += TYPING_FOR_MS - 500 // a is stale, b is not
    expect(t.active()).toEqual(['b'])
    t.clear('b')
    expect(t.active()).toEqual([])
  })
})
