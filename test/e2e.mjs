import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({ headless: true })
const failures = []

const viewports = [
  { name: 'iphone-se-320x568', width: 320, height: 568 },
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'large-phone-430x932', width: 430, height: 932 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1440x1000', width: 1440, height: 1000 },
]

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(overflow <= 1, `Overflow orizzontale di ${overflow}px su ${label}`)
}

async function assertNoFatalRuntimeErrors(pageErrors, consoleErrors, label) {
  if (pageErrors.length) throw new Error(`${label}: Page errors: ${pageErrors.join(' | ')}`)
  const fatalConsole = consoleErrors.filter((text) => /uncaught|referenceerror|typeerror|syntaxerror/i.test(text))
  if (fatalConsole.length) throw new Error(`${label}: Console runtime errors: ${fatalConsole.join(' | ')}`)
}

async function checkLoginShell({ name, width, height }, theme = 'dark') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  try {
    await page.addInitScript((selectedTheme) => localStorage.setItem('apicehotel.theme.v1', selectedTheme), theme)
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })

    assert.equal(await page.getByRole('heading', { name: 'RandApp' }).isVisible(), true, `Brand RandApp non visibile su ${name}`)
    assert.equal(await page.getByTestId('login-user-input').isVisible(), true, `Campo Utente non visibile su ${name}`)
    assert.equal(await page.getByTestId('login-pin-input').isVisible(), true, `Campo PIN non visibile su ${name}`)
    assert.equal(await page.getByTestId('login-submit').isVisible(), true, `ACCEDI non visibile su ${name}`)
    assert.equal(await page.getByTestId('open-settings-link').isVisible(), true, `Impostazioni non visibili su ${name}`)

    const resolvedTheme = await page.evaluate(() => document.documentElement.dataset.theme)
    assert.equal(resolvedTheme, theme, `Tema ${theme} non applicato su ${name}`)
    await assertNoHorizontalOverflow(page, `${name}-${theme}`)

    const submitBox = await page.getByTestId('login-submit').boundingBox()
    assert.ok(submitBox && submitBox.width >= 44 && submitBox.height >= 44, `Touch target ACCEDI troppo piccolo su ${name}`)
    const settingsBox = await page.getByTestId('open-settings-link').boundingBox()
    assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44, `Touch target Impostazioni troppo piccolo su ${name}`)

    await page.screenshot({ path: fileURLToPath(new URL(`${name}-${theme}.png`, artifacts)), fullPage: true })

    // Verifica che il percorso Impostazioni sia raggiungibile senza credenziali reali.
    await page.getByTestId('open-settings-link').click()
    await page.getByRole('heading', { name: 'Impostazioni' }).waitFor({ state: 'visible' })
    assert.equal(await page.getByTestId('admin-pin-input').isVisible(), true, `PIN amministratore non visibile su ${name}`)
    assert.equal(await page.getByTestId('admin-gate-submit').isVisible(), true, `ENTRA admin non visibile su ${name}`)
    await assertNoHorizontalOverflow(page, `${name}-${theme}-settings`)

    // Il ritorno deve riportare al nuovo login RandApp, mai alla vecchia scelta struttura.
    await page.getByRole('button', { name: /RandApp/ }).click()
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
    assert.equal(await page.getByText('Seleziona una struttura', { exact: true }).count(), 0, `Vecchia home struttura riapparsa su ${name}`)

    await assertNoFatalRuntimeErrors(pageErrors, consoleErrors, `${name}-${theme}`)
  } catch (error) {
    failures.push(`${name}-${theme}: ${error.message}`)
  } finally {
    await context.close()
  }
}

try {
  for (const viewport of viewports) await checkLoginShell(viewport, 'dark')
  // Light viene verificato su telefono, tablet e desktop; usa gli stessi componenti/token.
  for (const viewport of [viewports[1], viewports[3], viewports[4]]) await checkLoginShell(viewport, 'light')
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('E2E OK: nuovo login Dark Shell, Dark/Light, responsive 320-1440px, touch target, assenza overflow, accesso/ritorno Impostazioni e nessun errore runtime fatale')
}
