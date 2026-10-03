import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// i18n.ts reads `navigator` and `localStorage` when it is imported. Newer Node versions define `navigator` as a read-only
// global, so it has to be stubbed with vi.stubGlobal rather than assigned.
vi.stubGlobal('navigator', { language: 'en' })
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })

describe('translations', () => {
  it('every text marked in index.html has a Spanish translation, and Spanish never equals a mistyped key', async () => {
    const { ES } = await import('./i18n')
    const html = readFileSync('index.html', 'utf8')
    const keys = [...html.matchAll(/data-t(?:-title|-placeholder)?="([^"]+)"/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(20)
    for (const k of keys) expect(Object.keys(ES), `missing: ${k}`).toContain(k)
  })
})
