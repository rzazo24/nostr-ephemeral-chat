// Regenerates the README screenshots (docs/screenshot.png and docs/screenshot.es.png): the app on a computer and on a phone,
// with a short sample conversation, two reactions and the "is typing…" line.
//
//   npm i --no-save playwright && npx playwright install chromium     # once; Playwright is not a dependency of the project
//   npm run screenshots                                                # the live site
//   npm run screenshots -- --url=http://localhost:4173/                # a local `npm run build && npm run preview`
//   npm run screenshots -- --lang=en --out=/tmp/shots --pause=10
//
// It really talks to the relay behind the app, with two browser tabs from the same IP, and relays rate-limit per IP: the script
// waits between scenes and aborts if any message is rejected, instead of producing a screenshot with an error in it. Takes ~4 min.
import fs from 'node:fs'
import path from 'node:path'

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')))
const URL = args.url || 'https://chat.hivescope.xyz/'
const LANGS = (args.lang || 'en,es').split(',')
const OUT = path.resolve(args.out || 'docs')
const PAUSE_MS = Number(args.pause ?? 25) * 1000

let chromium, devices
try { ({ chromium, devices } = await import('playwright')) } catch {
  console.error('Playwright is not installed. Run:  npm i --no-save playwright && npx playwright install chromium')
  process.exit(1)
}

const SCRIPT = {
  en: { guest: ['Hey! Did you get the link?', 'Right: close the tab and it is gone'], me: ['Yes, I am in 👋', 'Nothing is stored, right?'], typing: 'and the room name is' },
  es: { guest: ['¡Hola! ¿Te llegó el enlace?', 'Así es: cierras la pestaña y desaparece'], me: ['Sí, ya estoy dentro 👋', '¿No se guarda nada, verdad?'], typing: 'y el nombre de la sala es' },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'chat-shots-'))
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function scene(lang, kind) {
  // "me" is the one photographed; "guest" is the other participant (a phone when photographing the desktop, and vice versa)
  const desktop = { viewport: { width: 1100, height: 880 }, deviceScaleFactor: 1.5 }
  const phone = { ...devices['iPhone 13'], viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 }
  const open = async (opts) => {
    const ctx = await browser.newContext({ ...opts, locale: lang })
    await ctx.addInitScript((l) => { try { localStorage.setItem('chat-lang', l) } catch { /* no storage */ } }, lang)
    return ctx.newPage()
  }
  const me = await open(kind === 'desktop' ? desktop : phone)
  await me.goto(URL)
  const guest = await open(kind === 'desktop' ? devices['iPhone 13'] : { viewport: { width: 1100, height: 720 } })
  await guest.goto(me.url())
  await me.waitForFunction(() => document.querySelectorAll('#online li').length >= 2, null, { timeout: 20000 })

  const say = async (page, text) => { await page.fill('#text', text); await page.press('#text', 'Enter'); await page.waitForTimeout(1500) }
  const s = SCRIPT[lang]
  await say(guest, s.guest[0]); await say(me, s.me[0]); await say(guest, s.guest[1]); await say(me, s.me[1])

  // the reaction palette closes when the list scrolls, so scroll the message into view first
  const react = async (page, emoji) => {
    const li = page.locator('#log li.other').first()
    await li.scrollIntoViewIfNeeded(); await page.waitForTimeout(300)
    await li.locator('.chip.add').click(); await page.waitForSelector('#palette:not([hidden])')
    await page.locator('#palette .chip', { hasText: emoji }).click(); await page.waitForTimeout(400)
  }
  await react(me, '👍'); await react(guest, '❤️')

  // the "is typing" beat can be dropped by the rate limiter: wait for it to refill and retry
  let shown = false
  for (let attempt = 0; attempt < 4 && !shown; attempt++) {
    await me.waitForTimeout(attempt ? 6000 : 3000)
    await guest.fill('#text', ''); await guest.waitForTimeout(300)
    await guest.locator('#text').pressSequentially(s.typing, { delay: 25 })
    shown = await me.waitForFunction(() => document.getElementById('typing').textContent.length > 0, null, { timeout: 5000 }).then(() => true, () => false)
  }
  if (!shown) throw new Error(`the "is typing" line never showed up (${lang} ${kind})`)
  for (const page of [me, guest]) {
    if ((await page.locator('#log li.note', { hasText: /rate-limited|No se ha enviado|Not sent/ }).count()) > 0) throw new Error(`a message was rejected by the relay (${lang} ${kind}); try a larger --pause`)
  }
  await me.evaluate(() => { const l = document.getElementById('log'); l.scrollTop = l.scrollHeight })
  await me.mouse.move(2, 2)
  await me.screenshot({ path: path.join(tmp, `${kind}-${lang}.png`) })
  await me.context().close(); await guest.context().close()
}

for (const lang of LANGS) {
  for (const kind of ['desktop', 'phone']) {
    console.log(`${lang} / ${kind}…`)
    await sleep(PAUSE_MS) // let the relay's per-IP limiter refill
    await scene(lang, kind)
  }
}

// Side by side on the app's own background colour.
const page = await browser.newPage({ viewport: { width: 1640, height: 940 } })
const img = (file, style) => `<img src="data:image/png;base64,${fs.readFileSync(path.join(tmp, file)).toString('base64')}" style="flex:none;${style};border:1px solid #1f2a3a;box-shadow:0 18px 50px rgba(0,0,0,.55)">`
for (const lang of LANGS) {
  await page.setContent(`<body style="margin:0;background:#0b0f16;width:1640px;height:940px;display:flex;align-items:center;justify-content:center;gap:36px">${img(`desktop-${lang}.png`, 'width:1046px;height:837px;border-radius:14px')}${img(`phone-${lang}.png`, 'width:430px;height:860px;border-radius:30px')}</body>`)
  await page.waitForTimeout(300)
  const file = path.join(OUT, lang === 'en' ? 'screenshot.png' : `screenshot.${lang}.png`)
  await page.screenshot({ path: file })
  console.log('wrote', file)
}
await browser.close()
fs.rmSync(tmp, { recursive: true, force: true })
