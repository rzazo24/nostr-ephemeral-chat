import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// i18n.ts touches `navigator`/`localStorage` only inside functions that run at import time, so stub them for Node.
Object.assign(globalThis, { navigator: { language: 'en' }, localStorage: { getItem: () => null, setItem: () => {} } })

describe('translations', () => {
  it('every text marked in index.html has a Spanish translation, and Spanish never equals a mistyped key', async () => {
    const { ES } = await import('./i18n')
    const html = readFileSync('index.html', 'utf8')
    const keys = [...html.matchAll(/data-t(?:-title|-placeholder)?="([^"]+)"/g)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(20)
    for (const k of keys) expect(Object.keys(ES), `missing: ${k}`).toContain(k)
  })
})
