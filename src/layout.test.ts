import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('navigator', { language: 'en' })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })

// The message window is "the rest of the screen", so anything above or below it that changes height makes it shrink and stretch.
// These guard the causes found on phones (measured in a browser): see the notes in style.css.
describe('layout stability', () => {
  const css = readFileSync('src/style.css', 'utf8')
  it('the "is typing" line has a fixed one-line height and never wraps', () => {
    const rule = css.match(/\.typing \{[^}]*\}/)![0]
    expect(rule).toMatch(/height:\s*1\.5em/)
    expect(rule).toContain('white-space:nowrap')
  })
  it('the connection status never wraps (a second line made the header grow by 20 px)', () => {
    expect(css.match(/\.status \{[^}]*\}/)![0]).toContain('white-space:nowrap')
  })
  it('the page does not scroll or rubber-band, only the message list does', () => {
    expect(css).toMatch(/html, body \{ overscroll-behavior: none \}/)
    expect(css).toMatch(/#log \{ overscroll-behavior: contain \}/)
  })
  it('status texts are short enough for the phone header in both languages', async () => {
    const { t } = await import('./i18n')
    for (const s of ['connecting…', 'connected', 'reconnecting…'] as const) expect(t(s).length, s).toBeLessThanOrEqual(14)
  })
  it('the dialogs take focus themselves so no button inside looks permanently highlighted', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toMatch(/<dialog id="help"[^>]*autofocus/)
    expect(html).toMatch(/<dialog id="qr"[^>]*autofocus/)
  })
})
