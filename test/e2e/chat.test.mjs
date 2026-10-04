// Browser tests of the real app against a real relay, served under the production content-security policies (see harness.mjs).
//   npm run build && cd test/e2e && npm install && npx playwright install chromium && RELAY_BIN=/path/to/nostr-relay-khatru npm test
import assert from 'node:assert/strict'
import { after, afterEach, before, describe, it } from 'node:test'
import { chromium, devices } from 'playwright'
import { startStack } from './harness.mjs'

let browser, normal
const contexts = []
const problems = [] // console errors and uncaught exceptions of every page (checked by the last test)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Opens the app in a fresh browser context (a "person"). `device` is a Playwright device name; `lang` the browser language. */
async function open(stack, { device = null, lang = 'en-US', url = stack.appUrl } = {}) {
  const base = device ? devices[device] : { viewport: { width: 1100, height: 800 } }
  const ctx = await browser.newContext({ ...base, locale: lang })
  contexts.push(ctx)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`) })
  await page.goto(url)
  return page
}
const online = (page) => page.waitForFunction(() => document.getElementById('status').dataset.state === 'open', null, { timeout: 15000 })

/** Two people in the same room, both connected and seeing each other. */
async function pair(stack, devA = null, devB = null) {
  const a = await open(stack, { device: devA })
  await online(a)
  const b = await open(stack, { device: devB, url: a.url() })
  await online(b)
  await a.waitForFunction(() => document.querySelectorAll('#online li').length >= 2, null, { timeout: 15000 })
  return { a, b }
}
const say = async (page, text) => { await page.fill('#text', text); await page.press('#text', 'Enter') }
const theirs = (page, text) => page.waitForFunction((t) => [...document.querySelectorAll('#log li.other span')].some((s) => s.textContent === t), text, { timeout: 15000 })
/** Waits (at most 10 s) for the service worker to be installed and active: under a too-strict CSP it never is. */
const swReady = (page) => page.evaluate(() => Promise.race([
  navigator.serviceWorker.ready.then(() => 'ready'),
  new Promise((r) => setTimeout(() => r('timeout'), 10000)),
])).then((r) => assert.equal(r, 'ready', 'the service worker installed (a CSP that stops it from fetching its own files makes this fail)'))
const noTransitions = (page) => page.evaluate(() => { const sh = new CSSStyleSheet(); sh.replaceSync('button{transition:none!important}'); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sh] })

describe('ephemeral chat', () => {
  before(async () => {
    browser = await chromium.launch()
    normal = await startStack()
  })
  after(async () => {
    await browser?.close()
    await normal?.stop()
  })
  afterEach(async () => { await Promise.all(contexts.splice(0).map((c) => c.close().catch(() => {}))) })

  it('two people: they see each other, exchange messages, links are safe and HTML is just text', async () => {
    const { a, b } = await pair(normal)
    assert.match(await a.locator('#people-summary').innerText(), /2/)
    await say(a, 'Hello <b>x</b> <img src=x onerror="window.__xss=1"> https://example.com/a?x=1.')
    await b.waitForSelector('#log li.other a')
    const link = b.locator('#log li.other a')
    assert.equal(await link.getAttribute('href'), 'https://example.com/a?x=1')
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer nofollow')
    assert.equal(await link.getAttribute('target'), '_blank')
    assert.ok((await b.locator('#log li.other span').innerText()).includes('<b>x</b> <img src=x'), 'HTML is shown as text')
    assert.equal(await b.locator('#log img, #log b:not(:first-child)').count(), 0)
    assert.equal(await b.evaluate(() => window.__xss ?? 'no'), 'no')
    await say(b, 'and back')
    await theirs(a, 'and back')
  })

  it('room names: the same for everyone in a room, a short code, different between rooms', async () => {
    const { a, b } = await pair(normal)
    const na = await a.locator('#room-name').innerText(), nb = await b.locator('#room-name').innerText()
    assert.equal(na, nb)
    assert.match(na, /^#[a-km-z2-9]{3}-[a-km-z2-9]{3}-[a-km-z2-9]{3}$/)
    assert.ok((await a.title()).startsWith(`${na} ·`))
    const other = await open(normal)
    await online(other)
    assert.notEqual(await other.locator('#room-name').innerText(), na)
  })

  it('reactions: added, counted, removed by clicking again, and seen by the other person', async () => {
    const { a, b } = await pair(normal)
    await say(a, 'react to this')
    await theirs(b, 'react to this')
    const li = b.locator('#log li.other').first()
    await li.scrollIntoViewIfNeeded(); await sleep(300) // the palette closes when the list scrolls
    await li.locator('.chip.add').click()
    await b.locator('#palette .chip', { hasText: '👍' }).click()
    await a.waitForFunction(() => /👍 1/.test(document.querySelector('#log li.mine .reactions').textContent), null, { timeout: 10000 })
    await b.locator('#log li.other .chip.mine').click() // click my own reaction again: remove it
    await a.waitForFunction(() => !/👍/.test(document.querySelector('#log li.mine .reactions').textContent), null, { timeout: 10000 })
  })

  it('"is typing…" shows for the other person and goes away when the message arrives', async () => {
    const { a, b } = await pair(normal)
    await b.locator('#text').pressSequentially('hel', { delay: 40 })
    await a.waitForFunction(() => /is typing/.test(document.getElementById('typing').textContent), null, { timeout: 10000 })
    await b.press('#text', 'Enter')
    await a.waitForFunction(() => document.getElementById('typing').textContent === '', null, { timeout: 10000 })
  })

  it('message box on a computer: Enter sends, Shift+Enter adds a line, it grows, keeps the line breaks and counts near the limit', async () => {
    const { a, b } = await pair(normal)
    const one = await a.locator('#text').evaluate((e) => e.getBoundingClientRect().height)
    await a.locator('#text').pressSequentially('line one')
    await a.keyboard.press('Shift+Enter')
    await a.locator('#text').pressSequentially('line two')
    await a.keyboard.press('Shift+Enter')
    await a.locator('#text').pressSequentially('line three')
    assert.equal(await a.locator('#log li.mine:not(.pending)').count(), 0, 'Shift+Enter did not send')
    assert.ok((await a.locator('#text').evaluate((e) => e.getBoundingClientRect().height)) > one + 20, 'the box grew')
    await a.press('#text', 'Enter')
    await theirs(b, 'line one\nline two\nline three')
    assert.equal(await a.inputValue('#text'), '', 'the box is emptied and shrinks back')
    assert.ok(Math.abs((await a.locator('#text').evaluate((e) => e.getBoundingClientRect().height)) - one) < 2)
    // close to the 1000-character limit a counter appears
    await a.fill('#text', 'x'.repeat(960))
    assert.equal(await a.locator('#count').innerText(), '960/1000')
    assert.equal(await a.locator('#count').evaluate((e) => e.classList.contains('near')), true)
    await a.fill('#text', 'short')
    assert.equal(await a.locator('#count').innerText(), '')
    // many lines: the box stops growing (it scrolls inside)
    await a.fill('#text', Array.from({ length: 30 }, (_, i) => `l${i}`).join('\n'))
    await a.locator('#text').dispatchEvent('input')
    const tall = await a.locator('#text').evaluate((e) => ({ h: e.getBoundingClientRect().height, max: parseFloat(getComputedStyle(e).maxHeight) }))
    assert.ok(tall.h <= tall.max + 1, `capped at max-height (${tall.h} <= ${tall.max})`)
  })

  it('message box on a phone: Enter adds a line, the Send button sends', async () => {
    const { a, b } = await pair(normal, 'iPhone 13', null)
    assert.equal(await a.evaluate(() => matchMedia('(pointer: coarse)').matches), true)
    await a.locator('#text').pressSequentially('first')
    await a.keyboard.press('Enter')
    await a.locator('#text').pressSequentially('second')
    await sleep(600)
    assert.equal(await a.locator('#log li.mine').count(), 0, 'Enter did not send on a touch screen')
    assert.equal(await a.inputValue('#text'), 'first\nsecond')
    await a.tap('button[type=submit]')
    await theirs(b, 'first\nsecond')
  })

  it('too fast for the real relay: what does not fit waits (dimmed, "Waiting for the relay…") instead of looking lost', async () => {
    // a fresh relay: its allowance (5 in a row) is only freed at the next minute mark, a minute after it starts
    const fresh = await startStack({ RELAY_EVENTS_PER_MINUTE: '30', RELAY_EVENTS_BURST: '5' })
    try {
      const a = await open(fresh); await online(a)
      const b = await open(fresh, { url: a.url() }); await online(b)
      // the presence beats of both people already spent most of the allowance
      for (let i = 1; i <= 7; i++) await a.evaluate((n) => { document.getElementById('text').value = `msg ${n}`; document.getElementById('form').requestSubmit() }, i)
      await b.waitForFunction(() => document.querySelectorAll('#log li.other').length >= 1, null, { timeout: 10000 })
      await a.waitForFunction(() => [...document.querySelectorAll('#log li.pending b')].some((x) => /Waiting for the relay/.test(x.textContent)), null, { timeout: 15000 })
      assert.equal(await a.locator('#log li.note', { hasText: /Not sent/ }).count(), 0, 'nothing is reported as failed while it is still being retried')
      assert.ok((await a.locator('#log li.pending').count()) >= 1, 'the waiting messages stay on screen, dimmed')
    } finally { await fresh.stop() }
  })

  /** Moves the page's fake time forward in small steps (letting the network answer in between) until `done()` is true. */
  async function advanceUntil(page, done, maxMs = 90000) {
    for (let t = 0; t < maxMs && !(await done()); t += 500) { await page.clock.runFor(500); await sleep(25) }
    assert.equal(await done(), true, 'the condition came true within the simulated time')
  }

  it('too fast, then OK: the message is retried by itself and arrives, with a note while it waits and no error', async () => {
    const stack = await startStack({}, { stub: { rejectFirst: 3 } })
    try {
      const a = await open(stack)
      await online(a)
      await a.clock.install() // from here on the page's timers (the retry pauses) only move when the test advances them
      await a.evaluate(() => { document.getElementById('text').value = 'keep trying'; document.getElementById('form').requestSubmit() })
      await advanceUntil(a, () => a.evaluate(() => [...document.querySelectorAll('#log li.pending b')].some((x) => /Waiting for the relay/.test(x.textContent))), 5000)
      await advanceUntil(a, () => a.evaluate(() => [...document.querySelectorAll('#log li.mine:not(.pending) span')].some((s) => s.textContent === 'keep trying')))
      assert.equal(stack.stub.stats.rejected, 3)
      assert.equal(stack.stub.stats.messages, 4, 'tried four times: three rejections and then it got through')
      assert.equal(stack.stub.stats.accepted.filter((e) => e.kind === 20001).length, 1)
      assert.equal(await a.locator('#log li.note', { hasText: /Not sent/ }).count(), 0)
      await advanceUntil(a, () => a.evaluate(() => document.querySelectorAll('#log li.pending').length === 0), 10000)
    } finally { await stack.stop() }
  })

  it('too fast and it never gets through: after about a minute, a clear message in the user language, and the text is given back', async () => {
    const stack = await startStack({}, { stub: { rejectFirst: Infinity } })
    try {
      const a = await open(stack, { lang: 'es-ES' })
      await online(a)
      await a.clock.install()
      await a.evaluate(() => { document.getElementById('text').value = 'este no va a poder salir'; document.getElementById('form').requestSubmit() })
      await advanceUntil(a, () => a.evaluate(() => /No se ha enviado/.test(document.querySelector('#log').textContent)))
      const note = await a.locator('#log li.note').last().innerText()
      assert.match(note, /limitando la velocidad/, note)
      assert.ok(!/rate-limited|slow down/i.test(note), 'the relay wording is not shown raw')
      assert.equal(await a.inputValue('#text'), 'este no va a poder salir', 'the text is back in the box')
      assert.equal(await a.locator('#log li.pending').count(), 0)
      assert.equal(stack.stub.stats.messages, 6, 'the first try and five retries, and then it gave up')
    } finally { await stack.stop() }
  })

  it('layout: no horizontal scroll on phones, English and Spanish, and the message window never changes height by itself', async () => {
    for (const lang of ['en-US', 'es-ES']) for (const width of [320, 375, 390, 430]) {
      const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width, height: 760 }, locale: lang })
      contexts.push(ctx)
      const page = await ctx.newPage()
      await page.addInitScript(() => { navigator.share = () => Promise.resolve() })
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
      await page.goto(normal.appUrl)
      await online(page)
      await page.evaluate(() => { document.getElementById('install').hidden = false }) // all five action buttons
      const m = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth > innerWidth,
        cut: [...document.querySelectorAll('#bar .actions button:not([hidden])')].filter((b) => b.scrollWidth > b.clientWidth + 1 || b.getBoundingClientRect().right > document.getElementById('bar').getBoundingClientRect().right).map((b) => b.textContent),
      }))
      assert.equal(m.scroll, false, `${lang} ${width}px: page scrolls sideways`)
      assert.deepEqual(m.cut, [], `${lang} ${width}px: buttons whose text overflows`)
    }
    // the log is "the rest of the screen": nothing above or below it may change height when texts change
    const page = await open(normal, { device: 'iPhone SE' })
    await online(page)
    const height = () => page.evaluate(() => Math.round(document.getElementById('log').getBoundingClientRect().height * 10) / 10)
    const base = await height()
    for (const s of ['connecting…', 'connected', 'reconnecting…', 'conectando…', 'conectado', 'reconectando…', 'offline, retrying…', 'sin conexión, reintentando…', 'a much longer status text that must never wrap onto a second line']) {
      await page.evaluate((t) => { document.getElementById('status-text').textContent = t }, s)
      assert.equal(await height(), base, `status «${s}» changed the chat height`)
    }
    for (const s of ['quick-hedgehog-42 is typing…', 'quick-hedgehog-42 & bright-octopus-77 are typing…', 'Several people are typing…', '']) {
      await page.evaluate((t) => { document.getElementById('typing').textContent = t }, s)
      assert.equal(await height(), base, `typing text «${s}» changed the chat height`)
    }
  })

  it('buttons flash for about a second when pressed and never stay lit; the help dialog does not highlight its Close button', async () => {
    const a = await open(normal, { device: 'iPhone 13' })
    await online(a)
    await noTransitions(a)
    for (const sel of ['#share', '#qr-btn', '#help-btn']) {
      const r = await a.evaluate((q) => new Promise((resolve) => {
        const b = document.querySelector(q)
        const base = getComputedStyle(b).borderTopColor
        const t0 = performance.now()
        b.click()
        const during = { flash: b.classList.contains('flash'), border: getComputedStyle(b).borderTopColor }
        const tick = () => (b.classList.contains('flash') ? requestAnimationFrame(tick) : resolve({ base, during, ms: Math.round(performance.now() - t0), after: getComputedStyle(b).borderTopColor }))
        tick()
      }), sel)
      assert.equal(r.during.flash, true, `${sel} flashes`)
      assert.equal(r.during.border, 'rgb(45, 212, 191)', `${sel} is lit while flashing`)
      assert.ok(r.ms >= 900 && r.ms < 4000, `${sel} flash lasts ~1 s (${r.ms} ms)`)
      assert.equal(r.after, r.base, `${sel} goes back to normal`)
      await a.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
    }
    await a.tap('#help-btn')
    assert.equal(await a.evaluate(() => document.activeElement.id), 'help', 'the dialog itself takes the focus, not the Close button')
    const fit = await a.evaluate(() => { const r = document.getElementById('help').getBoundingClientRect(), c = document.getElementById('help-close').getBoundingClientRect(); return { top: r.top, bottom: innerHeight - r.bottom, closeVisible: c.top >= 0 && c.bottom <= innerHeight } })
    assert.ok(fit.top >= 8 && fit.bottom >= 8 && fit.closeVisible, `the help is a sheet inside the screen: ${JSON.stringify(fit)}`)
  })

  it('share and QR: the QR dialog opens with a real image', async () => {
    const a = await open(normal)
    await online(a)
    await a.click('#qr-btn')
    assert.equal(await a.evaluate(() => document.getElementById('qr').open), true)
    await a.waitForFunction(() => document.getElementById('qr-img').naturalWidth > 100)
    assert.match(await a.getAttribute('#qr-img', 'src'), /^data:image\/gif/)
    await a.keyboard.press('Escape')
    assert.equal(await a.evaluate(() => document.getElementById('qr').open), false)
  })

  it('Spanish: follows the browser language, can be switched with the buttons, and is remembered', async () => {
    const a = await open(normal, { lang: 'es-ES' })
    await online(a)
    assert.equal(await a.evaluate(() => document.documentElement.lang), 'es')
    assert.match(await a.innerText('#bar'), /Sala:/)
    await a.click('[data-lang=en]')
    assert.match(await a.innerText('#bar'), /Room:/)
    await a.reload(); await online(a)
    assert.match(await a.innerText('#bar'), /Room:/, 'the choice survives a reload')
    await a.click('[data-lang=es]')
    assert.match(await a.title(), /Chat efímero/)
  })

  it('installable app under the real CSP: the service worker installs, the manifest is valid, the shell opens offline', async () => {
    const a = await open(normal)
    await online(a)
    await swReady(a)
    await a.reload()
    await a.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 })
    const manifest = await (await a.context().request.get(normal.appUrl + 'manifest.webmanifest')).json()
    assert.equal(manifest.display, 'standalone')
    for (const i of manifest.icons) assert.equal((await a.context().request.get(normal.appUrl + i.src.slice(1))).headers()['content-type'], 'image/png', i.src)
    const cdp = await a.context().newCDPSession(a)
    assert.deepEqual((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors, [], 'no installability errors')
    // offline: a new tab still gets the app (from the cache), shows it is disconnected, and has no uncaught errors
    await a.context().setOffline(true)
    const off = await a.context().newPage()
    off.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
    await off.goto(normal.appUrl + '#aaaaaaaabbbbbbbb')
    await off.waitForSelector('#form')
    await off.waitForFunction(() => document.getElementById('status').dataset.state === 'closed', null, { timeout: 10000 })
    assert.match(await off.innerText('#status-text'), /reconnecting/)
    await a.context().setOffline(false)
  })

  it('a new version: the page keeps running, a bar offers Reload, and Reload switches to it in the same room', async () => {
    const a = await open(normal)
    await online(a)
    await swReady(a)
    await a.reload(); await a.waitForFunction(() => !!navigator.serviceWorker.controller)
    await a.evaluate(() => { window.__same = 1 })
    assert.equal(await a.locator('#update').isHidden(), true, 'no bar at first (a first install must not nag or reload)')
    const caches = () => a.evaluate(async () => (await window.caches.keys()).join())
    const before = await caches()
    normal.bumpVersion() // "deploy"
    await a.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update() })
    await a.waitForSelector('#update:not([hidden])', { timeout: 10000 })
    assert.equal(await a.evaluate(() => window.__same), 1, 'the running page was not reloaded behind the user')
    const room = a.url()
    await a.click('#update-reload')
    await a.waitForFunction(() => window.__same === undefined, null, { timeout: 10000 })
    await a.waitForSelector('#form')
    assert.equal(a.url(), room, 'same room after reloading')
    assert.notEqual(await caches(), before, 'the new version has its own cache')
    assert.equal(await a.locator('#update').isHidden(), true)
  })

  it('no console errors, uncaught exceptions or CSP violations anywhere in the run', () => {
    assert.deepEqual(problems.filter((p) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(p)), [])
  })
})
