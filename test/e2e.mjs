import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({ headless: true })
const failures = []

async function checkPage({ name, width, height }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []

  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Seleziona una struttura' }).waitFor()

    for (const hotel of ['Hotel Giò', 'ChocoHotel', 'Il Brigantino']) {
      assert.equal(await page.getByRole('button', { name: hotel, exact: true }).isVisible(), true, `${hotel} non visibile su ${name}`)
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(overflow <= 1, `Overflow orizzontale di ${overflow}px su ${name}`)

    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, artifacts)), fullPage: true })

    // Verifica il percorso fino al login senza dipendere da PIN demo o segreti CI.
    await page.getByRole('button', { name: 'Hotel Giò', exact: true }).click()
    await page.getByLabel('PIN di 4 cifre').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Accedi' }).isVisible(), true)

    const loginOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(loginOverflow <= 1, `Overflow login di ${loginOverflow}px su ${name}`)

    if (pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`)

    // Errori di rete/API sono possibili in CI senza credenziali Supabase; gli errori JS runtime no.
    const fatalConsole = consoleErrors.filter((text) => /uncaught|referenceerror|typeerror|syntaxerror/i.test(text))
    if (fatalConsole.length) throw new Error(`Console runtime errors: ${fatalConsole.join(' | ')}`)
  } catch (error) {
    failures.push(`${name}: ${error.message}`)
  } finally {
    await context.close()
  }
}

try {
  await checkPage({ name: 'home-320x568', width: 320, height: 568 })
  await checkPage({ name: 'home-390x844', width: 390, height: 844 })
  await checkPage({ name: 'home-1440x1000', width: 1440, height: 1000 })
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('E2E OK: selezione hotel, layout responsive, assenza overflow, apertura login e nessun errore runtime fatale')
}
