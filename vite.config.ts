import { readFileSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

// Gives every build its own service-worker cache name (see public/sw.js).
const stampServiceWorker = (): Plugin => ({
  name: 'stamp-service-worker',
  apply: 'build',
  closeBundle() {
    const file = 'dist/sw.js'
    writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD__', Date.now().toString(36)))
  },
})

export default defineConfig({ plugins: [stampServiceWorker()], build: { target: 'es2022' }, test: { environment: 'node' } })
