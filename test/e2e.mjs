import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, webkit, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const failures = []

const desktopViewports = [
  { name: 'iphone-se-320x568', width: 320, height: 568 },
  { name: 'iphone-390x844', width: 390, height: 844 },
  { name: 'large-phone-430x932', width: 430, height: 932 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1440x1000', width: 1440, height: 1000 },
]

const engineScenarios = [
  { name: 'android-pixel7-chromium', type: chromium, context: devices['Pixel 7'] },
  { name: 'ios-iphone13-webkit', type: webkit, context: devices['iPhone 13'] },
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

async function checkLoginShell(browser, label, contextOptions, theme = 'dark', uiSize = 'normal', expectedResolvedTheme = theme) {
  const context = await browser.newContext(contextOptions)
  const page = await context.newPage()
  const pageErrors = []
  const consoleErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })

  try {
    await page.addInitScript(({ selectedTheme, selectedSize }) => {
      localStorage.setItem('apicehotel.theme.v1', selectedTheme)
      localStorage.setItem('apicehotel.ui-size.v1', selectedSize)
    }, { selectedTheme: theme, selectedSize: uiSize })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })

    assert.equal(await page.getByRole('heading', { name: 'RandApp' }).isVisible(), true, `Brand RandApp non visibile su ${label}`)
    assert.equal(await page.getByTestId('login-user-input').isVisible(), true, `Campo Utente non visibile su ${label}`)
    assert.equal(await page.getByTestId('login-pin-input').isVisible(), true, `Campo PIN non visibile su ${label}`)
    assert.equal(await page.getByTestId('login-submit').isVisible(), true, `ACCEDI non visibile su ${label}`)
    assert.equal(await page.getByTestId('open-settings-link').isVisible(), true, `Impostazioni non visibili su ${label}`)

    const domState = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      themeChoice: document.documentElement.dataset.themeChoice,
      uiSize: document.documentElement.dataset.uiSize,
    }))
    assert.equal(domState.theme, expectedResolvedTheme, `Tema risolto ${expectedResolvedTheme} non applicato su ${label}`)
    assert.equal(domState.themeChoice, theme, `Scelta tema ${theme} non preservata su ${label}`)
    assert.equal(domState.uiSize, uiSize, `Dimensione UI ${uiSize} non applicata su ${label}`)
    await assertNoHorizontalOverflow(page, `${label}-${theme}-${uiSize}`)

    const submitBox = await page.getByTestId('login-submit').boundingBox()
    assert.ok(submitBox && submitBox.width >= 44 && submitBox.height >= 44, `Touch target ACCEDI troppo piccolo su ${label}`)
    const settingsBox = await page.getByTestId('open-settings-link').boundingBox()
    assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44, `Touch target Impostazioni troppo piccolo su ${label}`)

    await page.screenshot({ path: fileURLToPath(new URL(`${label}-${theme}-${uiSize}.png`, artifacts)), fullPage: true })

    await page.getByTestId('open-settings-link').click()
    await page.getByRole('heading', { name: 'Impostazioni' }).waitFor({ state: 'visible' })
    assert.equal(await page.getByTestId('admin-pin-input').isVisible(), true, `PIN amministratore non visibile su ${label}`)
    assert.equal(await page.getByTestId('admin-gate-submit').isVisible(), true, `ENTRA admin non visibile su ${label}`)
    await assertNoHorizontalOverflow(page, `${label}-${theme}-${uiSize}-settings`)

    await page.getByRole('button', { name: /RandApp/ }).click()
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
    assert.equal(await page.getByText('Seleziona una struttura', { exact: true }).count(), 0, `Vecchia home struttura riapparsa su ${label}`)

    await context.setOffline(true)
    await page.waitForTimeout(150)
    assert.equal(await page.getByRole('heading', { name: 'Bentornato' }).isVisible(), true, `Login instabile offline su ${label}`)
    await assertNoHorizontalOverflow(page, `${label}-${theme}-${uiSize}-offline`)
    await context.setOffline(false)

    await assertNoFatalRuntimeErrors(pageErrors, consoleErrors, `${label}-${theme}-${uiSize}`)
  } catch (error) {
    failures.push(`${label}-${theme}-${uiSize}: ${error.message}`)
  } finally {
    await context.close()
  }
}

const chromiumBrowser = await chromium.launch({ headless: true })
try {
  for (const viewport of desktopViewports) {
    await checkLoginShell(chromiumBrowser, viewport.name, { viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 }, 'dark', 'normal', 'dark')
  }
  for (const viewport of [desktopViewports[1], desktopViewports[3], desktopViewports[4]]) {
    await checkLoginShell(chromiumBrowser, viewport.name, { viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 }, 'light', 'normal', 'light')
  }
  await checkLoginShell(chromiumBrowser, 'phone-large-ui', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }, 'dark', 'large', 'dark')
  await checkLoginShell(chromiumBrowser, 'desktop-small-ui', { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 }, 'light', 'small', 'light')
  await checkLoginShell(chromiumBrowser, 'system-dark', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, colorScheme: 'dark' }, 'system', 'normal', 'dark')
  await checkLoginShell(chromiumBrowser, 'system-light', { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, colorScheme: 'light' }, 'system', 'normal', 'light')
} finally {
  await chromiumBrowser.close()
}

for (const scenario of engineScenarios) {
  const browser = await scenario.type.launch({ headless: true })
  try {
    await checkLoginShell(browser, scenario.name, scenario.context, 'dark', 'normal', 'dark')
    await checkLoginShell(browser, scenario.name, scenario.context, 'light', 'normal', 'light')
    await checkLoginShell(browser, `${scenario.name}-large`, scenario.context, 'dark', 'large', 'dark')
  } finally {
    await browser.close()
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('E2E OK: Chromium/Android/iPhone WebKit, Dark/Light/System, Small/Normal/Large, touch target, offline transition, assenza overflow e nessun errore runtime fatale')
}

if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_HEAD_REF === 'docs/automated-video-tutorials') {
  await import('./tutorial-video.mjs')
}
