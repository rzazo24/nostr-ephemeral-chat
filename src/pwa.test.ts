import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PWA files', () => {
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
  it('manifest has what installability needs', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.start_url).toBe('/')
    expect(manifest.display).toBe('standalone')
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true)
  })
  it('every icon exists and has the declared size', () => {
    for (const i of manifest.icons as { src: string; sizes: string }[]) {
      const file = 'public' + i.src
      expect(existsSync(file), file).toBe(true)
      const png = readFileSync(file)
      const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)]
      expect(`${w}x${h}`).toBe(i.sizes)
    }
    expect(existsSync('public/icons/apple-touch-icon.png')).toBe(true)
  })
  it('the page links the manifest and the iOS icon', () => {
    const html = readFileSync('index.html', 'utf8')
    expect(html).toContain('rel="manifest"')
    expect(html).toContain('rel="apple-touch-icon"')
  })
  it('the service worker is stamped per build and the CSP allows the manifest', () => {
    expect(readFileSync('public/sw.js', 'utf8')).toContain('__BUILD__')
    expect(readFileSync('deploy/chat.caddy.template', 'utf8')).toContain("manifest-src 'self'")
  })
  it('registers the service worker before the first top-level await (afterwards `load` may already have fired)', () => {
    const main = readFileSync('src/main.ts', 'utf8')
    expect(main.indexOf('serviceWorker.register')).toBeGreaterThan(-1)
    expect(main.indexOf('serviceWorker.register')).toBeLessThan(main.indexOf('await joinRoom('))
  })
  it('the service worker gets its own CSP that lets it fetch same-origin files (it runs under the CSP of its own script)', () => {
    const caddy = readFileSync('deploy/chat.caddy.template', 'utf8')
    const swPolicy = caddy.split('\n').find((l) => l.includes('header @sw Content-Security-Policy'))
    expect(swPolicy).toContain("connect-src 'self'")
    // and the page policy must not apply to it
    expect(caddy).toContain('@notsw not path /sw.js')
  })
})
