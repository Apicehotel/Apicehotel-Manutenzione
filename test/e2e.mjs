import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, webkit, devices } from 'playwright'
import { RANDUI_GUARD_VIEWPORTS, assertRandUiGeometry } from '../src/randapp/randui/guard.js'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const failures = []

const desktopViewports = RANDUI_GUARD_VIEWPORTS

const engineScenarios = [
  { name: 'android-pixel7-chromium', type: chromium, context: devices['Pixel 7'] },
  { name: 'ios-iphone13-webkit', type: webkit, context: devices['iPhone 13'] },
]

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(overflow <= 1, `Overflow orizzontale di ${overflow}px su ${label}`)
}

async function assertRandUiLayoutGuard(page, label) {
  const snapshot = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const documentWidth = document.documentElement.scrollWidth
    const visible = (element, rect) => {
      const style = getComputedStyle(element)
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0
    }
    const nodes = []
    const structural = document.querySelectorAll('.rs-root,.rs-app,.rs-content,[data-randui-template],[role="dialog"],.rs-modal,.rs-sheet')
    for (const element of structural) {
      const rect = element.getBoundingClientRect()
      nodes.push({
        subject: element.getAttribute('data-randui-template') ? `template:${element.getAttribute('data-randui-template')}` : element.className || element.tagName,
        visible: visible(element, rect),
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        allowViewportEscape: element.dataset.randuiScrollX === 'allowed',
      })
    }

    for (const root of document.querySelectorAll('[data-randui-template]')) {
      const actionables = root.querySelectorAll('button,a[href],input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"]')
      for (const element of actionables) {
        const rect = element.getBoundingClientRect()
        const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || element.getAttribute('placeholder') || element.value || ''
        nodes.push({
          subject: `${root.dataset.randuiTemplate}:${element.tagName.toLowerCase()}`,
          visible: visible(element, rect),
          actionable: true,
          disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true',
          touchExempt: element.dataset.randuiTouchExempt === 'true',
          accessibleName: String(name).trim(),
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    const templates = [...document.querySelectorAll('[data-randui-template]')].map((root) => ({
      id: root.getAttribute('data-randui-template'),
      h1Count: root.querySelectorAll('h1').length,
    }))
    const counts = new Map()
    for (const element of document.querySelectorAll('[id]')) counts.set(element.id, (counts.get(element.id) || 0) + 1)
    const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
    return { viewportWidth, documentWidth, nodes, templates, duplicateIds }
  })
  assertRandUiGeometry(snapshot, label)
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
    await assertRandUiLayoutGuard(page, `${label}-${theme}-${uiSize}`)

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
    await assertRandUiLayoutGuard(page, `${label}-${theme}-${uiSize}-settings`)

    await page.getByRole('button', { name: /RandApp/ }).click()
    await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
    assert.equal(await page.getByText('Seleziona una struttura', { exact: true }).count(), 0, `Vecchia home struttura riapparsa su ${label}`)

    await context.setOffline(true)
    await page.waitForTimeout(150)
    assert.equal(await page.getByRole('heading', { name: 'Bentornato' }).isVisible(), true, `Login instabile offline su ${label}`)
    await assertNoHorizontalOverflow(page, `${label}-${theme}-${uiSize}-offline`)
    await assertRandUiLayoutGuard(page, `${label}-${theme}-${uiSize}-offline`)
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
  for (const viewport of [desktopViewports[2], desktopViewports[4], desktopViewports[6]]) {
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
  console.log('E2E OK: RandUI Guard 320/375/390/430/768/1024/1440, Chromium/Android/iPhone WebKit, Dark/Light/System, Small/Normal/Large, touch target, offline transition, assenza overflow e nessun errore runtime fatale')
}
