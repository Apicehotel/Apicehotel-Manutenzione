import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const artifacts = new URL('./artifacts/', import.meta.url)
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
try {
  const context = await browser.newContext({ deviceScaleFactor: 1 })

  // Smartphone piccolo (es. iPhone SE)
  const smallMobile = await context.newPage()
  await smallMobile.setViewportSize({ width: 320, height: 568 })
  await smallMobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await smallMobile.getByRole('heading', { name: 'Seleziona una struttura' }).waitFor()
  await smallMobile.screenshot({ path: fileURLToPath(new URL('home-small-mobile.png', artifacts)), fullPage: true })

  // Smartphone standard
  const mobile = await context.newPage()
  await mobile.setViewportSize({ width: 390, height: 844 })
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' })
  await mobile.getByRole('heading', { name: 'Seleziona una struttura' }).waitFor()
  assert.equal(await mobile.getByRole('button', { name: 'Hotel Giò', exact: true }).isVisible(), true)
  await mobile.screenshot({ path: fileURLToPath(new URL('home-mobile.png', artifacts)), fullPage: true })
  await mobile.getByRole('button', { name: 'Hotel Giò', exact: true }).click()
  await mobile.getByLabel('PIN di 4 cifre').fill('0000')
  await mobile.getByRole('button', { name: 'Accedi' }).click()

  // Dopo il login la landing è la dashboard Home (nuova bottom nav a 5 voci).
  await mobile.getByRole('heading', { name: /^Ciao/ }).waitFor()
  assert.equal(await mobile.getByText('Sono in struttura').isVisible(), true)
  assert.equal(await mobile.getByRole('button', { name: 'Home' }).isVisible(), true)
  assert.equal(await mobile.getByRole('button', { name: 'Segnalazioni' }).isVisible(), true)
  assert.equal(await mobile.getByRole('button', { name: 'Altro' }).isVisible(), true)
  await mobile.screenshot({ path: fileURLToPath(new URL('dashboard-home-mobile.png', artifacts)), fullPage: true })

  // Naviga a Segnalazioni tramite la bottom nav.
  await mobile.getByRole('button', { name: 'Segnalazioni' }).click()
  await mobile.getByRole('heading', { name: 'Segnalazioni' }).waitFor()
  assert.equal(await mobile.getByText("Perdita d’acqua dal lavabo").isVisible(), true)
  await mobile.reload({ waitUntil: 'networkidle' })
  // Il reload riporta sulla Home (tab non persistito, ingresso fresco).
  await mobile.getByRole('heading', { name: /^Ciao/ }).waitFor()
  await mobile.getByRole('button', { name: 'Segnalazioni' }).click()
  await mobile.getByRole('heading', { name: 'Segnalazioni' }).waitFor()
  await mobile.screenshot({ path: fileURLToPath(new URL('operations-mobile.png', artifacts)), fullPage: true })

  // Desktop: niente bottom nav, sidebar laterale al suo posto.
  const desktop = await context.newPage()
  await desktop.setViewportSize({ width: 1440, height: 1000 })
  await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
  await desktop.getByRole('heading', { name: 'Seleziona una struttura' }).waitFor()
  await desktop.getByRole('button', { name: 'Hotel Giò', exact: true }).click()
  await desktop.getByLabel('PIN di 4 cifre').fill('0000')
  await desktop.getByRole('button', { name: 'Accedi' }).click()
  await desktop.getByRole('heading', { name: /^Ciao/ }).waitFor()
  await desktop.screenshot({ path: fileURLToPath(new URL('dashboard-home-desktop.png', artifacts)), fullPage: true })
  await desktop.getByRole('button', { name: 'Segnalazioni' }).click()
  await desktop.getByRole('heading', { name: 'Segnalazioni' }).waitFor()
  await desktop.screenshot({ path: fileURLToPath(new URL('operations-desktop.png', artifacts)), fullPage: true })

  await mobile.getByRole('button', { name: 'Home' }).click()
  await mobile.getByTitle('Logout').click()
  await mobile.getByRole('heading', { name: 'Seleziona una struttura' }).waitFor()
  console.log('E2E OK: selezione hotel, login PIN, dashboard Home, navigazione AppNav, sessione persistente, area operativa e logout')
} finally {
  await browser.close()
}
