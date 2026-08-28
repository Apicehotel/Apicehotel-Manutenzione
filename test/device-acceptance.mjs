import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, webkit, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/device-acceptance/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const failures = []
const scenarios = [
  { name: 'ios-iphone13-webkit', engine: webkit, context: devices['iPhone 13'] },
  { name: 'android-pixel7-chromium', engine: chromium, context: devices['Pixel 7'] },
  {
    name: 'windows-edge-like-chromium',
    engine: chromium,
    context: {
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
      deviceScaleFactor: 1,
    },
  },
]

async function noOverflow(page, label) {
  const { x, y } = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
  }))
  assert.ok(x <= 1, `${label}: overflow orizzontale ${x}px`)
  assert.ok(y >= 0, `${label}: viewport verticale non valido`)
}

async function waitForServiceWorker(page, label) {
  const state = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return { supported: false }
    try {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])
      return { supported: true, active: Boolean(registration?.active), controller: Boolean(navigator.serviceWorker.controller) }
    } catch {
      return { supported: true, active: false, controller: Boolean(navigator.serviceWorker.controller) }
    }
  })
  assert.equal(state.supported, true, `${label}: service worker non supportato nel browser di test`)
  assert.equal(state.active, true, `${label}: service worker non attivo`)
}

async function inspectManifest(page, label) {
  const manifest = await page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest', { cache: 'no-store' })
    return response.json()
  })
  assert.equal(manifest.name, 'RandApp - Manutenzione', `${label}: nome PWA non coerente`)
  assert.equal(manifest.display, 'standalone', `${label}: PWA non standalone`)
  assert.equal(manifest.start_url, '/', `${label}: start_url non valido`)
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'), `${label}: icona maskable 512 mancante`)
  assert.ok(manifest.icons.every((icon) => String(icon.src).includes('v=9')), `${label}: versione icone PWA non allineata al service worker`)
}

async function exerciseViewportAndKeyboard(page, context, label) {
  const pin = page.getByTestId('login-pin-input')
  await pin.focus()
  await pin.fill('0000')
  assert.equal(await pin.inputValue(), '0000', `${label}: input PIN non utilizzabile`)

  const original = page.viewportSize()
  if (original && original.height > 600) {
    await page.setViewportSize({ width: original.width, height: Math.max(420, Math.floor(original.height * 0.62)) })
    await pin.scrollIntoViewIfNeeded()
    assert.equal(await pin.isVisible(), true, `${label}: PIN coperto con viewport ridotta/tastiera`)
    await noOverflow(page, `${label}-keyboard`)
    await page.setViewportSize(original)
  }

  if (original) {
    await page.setViewportSize({ width: original.height, height: original.width })
    await noOverflow(page, `${label}-landscape`)
    await page.screenshot({ path: fileURLToPath(new URL(`${label}-landscape.png`, artifacts)), fullPage: true })
    await page.setViewportSize(original)
  }

  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
  assert.equal(await page.getByTestId('login-submit').isVisible(), true, `${label}: app shell non disponibile offline dopo reload`)
  await noOverflow(page, `${label}-offline-reload`)
  await context.setOffline(false)
}

for (const scenario of scenarios) {
  const browser = await scenario.engine.launch({ headless: true })
  const context = await browser.newContext(scenario.context)
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
    await inspectManifest(page, scenario.name)
    await waitForServiceWorker(page, scenario.name)
    await noOverflow(page, scenario.name)

    const submitBox = await page.getByTestId('login-submit').boundingBox()
    assert.ok(submitBox && submitBox.width >= 44 && submitBox.height >= 44, `${scenario.name}: touch target ACCEDI sotto 44px`)

    await page.screenshot({ path: fileURLToPath(new URL(`${scenario.name}-portrait.png`, artifacts)), fullPage: true })
    await exerciseViewportAndKeyboard(page, context, scenario.name)

    if (pageErrors.length) throw new Error(`runtime: ${pageErrors.join(' | ')}`)
    const fatal = consoleErrors.filter((text) => /uncaught|referenceerror|typeerror|syntaxerror/i.test(text))
    if (fatal.length) throw new Error(`console: ${fatal.join(' | ')}`)
  } catch (error) {
    failures.push(`${scenario.name}: ${error.message}`)
  } finally {
    await context.close()
    await browser.close()
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('DEVICE ACCEPTANCE OK: iPhone/WebKit, Android/Chromium, Windows-like Chromium; PWA, offline reload, tastiera/viewport, landscape, touch target e overflow')
}
