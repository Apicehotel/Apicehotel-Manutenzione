import assert from 'node:assert/strict'
import { chromium, webkit, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const failures = []
const hotels = [
  ['hotelgio', 'Hotel Giò'],
  ['chocohotel', 'ChocoHotel'],
  ['brigantino', 'Hotel Il Brigantino'],
]

async function seedShell(page, context, hotelId) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async ({ hotelId, hotelIds }) => {
    localStorage.setItem('apicehotel.theme.v1', 'dark')
    localStorage.setItem('apicehotel.ui-size.v1', 'normal')
    localStorage.setItem('apicehotel.session.v1', JSON.stringify({ hotelId, userId: 'e2e-admin', createdAt: Date.now() }))
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('apiceOffline', 3)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true })
        if (!db.objectStoreNames.contains('idmap')) db.createObjectStore('idmap', { keyPath: 'tempId' })
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('failures')) db.createObjectStore('failures', { keyPath: 'id', autoIncrement: true })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('cache', 'readwrite')
        const store = tx.objectStore('cache')
        const user = { id: 'e2e-admin', legacy_id: 'e2e-admin', auth_user_id: 'e2e-admin', name: 'E2E Admin', role: 'admin', hotels: hotelIds }
        for (const id of hotelIds) store.put({ key: `directory:${id}`, entity: 'directory', hotelId: id, items: [user], updatedAt: Date.now() })
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, { hotelId, hotelIds: hotels.map(([id]) => id) })
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('main-content').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId('hotel-chip').getByText(/Hotel Giò|ChocoHotel|Hotel Il Brigantino/).waitFor({ state: 'visible' })
}

async function noHorizontalOverflow(page, label) {
  const amount = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert.ok(amount <= 1, `${label}: overflow orizzontale ${amount}px`)
}

async function exerciseScenario(scenario) {
  const browser = await scenario.engine.launch({ headless: true })
  const context = await browser.newContext(scenario.context)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await seedShell(page, context, scenario.startHotel)
    const expectedName = hotels.find(([id]) => id === scenario.startHotel)[1]
    assert.equal(await page.getByTestId('hotel-chip').getByText(expectedName, { exact: true }).isVisible(), true, `${scenario.name}: hotel iniziale errato`)
    await noHorizontalOverflow(page, `${scenario.name}-home`)

    const bottomButtons = page.getByTestId('bottom-nav').locator('button')
    assert.ok(await bottomButtons.count() <= 5, `${scenario.name}: bottom nav oltre 5 pulsanti`)

    const chip = page.getByTestId('hotel-chip')
    await chip.click()
    for (const [id] of hotels) assert.equal(await page.getByTestId(`switch-hotel-${id}`).isVisible(), true, `${scenario.name}: hotel ${id} assente dallo switcher`)
    const nextHotel = scenario.startHotel === 'brigantino' ? 'hotelgio' : 'brigantino'
    const nextName = hotels.find(([id]) => id === nextHotel)[1]
    await page.getByTestId(`switch-hotel-${nextHotel}`).click()
    await page.getByTestId('hotel-chip').getByText(nextName, { exact: true }).waitFor({ state: 'visible' })
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('apicehotel.session.v1') || 'null'))
    assert.equal(stored?.hotelId, nextHotel, `${scenario.name}: cambio hotel non persistito`)

    const fab = page.getByTestId('fab-new')
    assert.equal(await fab.isVisible(), true, `${scenario.name}: FAB nuovo inserimento non visibile per admin`)
    await fab.click()
    await page.getByRole('heading', { name: 'Nuovo inserimento' }).waitFor({ state: 'visible' })
    for (const id of ['issue', 'planning-work', 'planning-sale']) {
      assert.equal(await page.getByTestId(`insert-${id}`).isVisible(), true, `${scenario.name}: azione ${id} assente dal launcher`)
    }
    await noHorizontalOverflow(page, `${scenario.name}-insert-launcher`)

    assert.equal(errors.length, 0, `${scenario.name}: errori runtime: ${errors.join(' | ')}`)
  } catch (error) { failures.push(`${scenario.name}: ${error.message}`) }
  finally { await context.close(); await browser.close() }
}

const scenarios = [
  { name: 'ios-webkit', engine: webkit, context: devices['iPhone 13'], startHotel: 'hotelgio' },
  { name: 'android-chromium', engine: chromium, context: devices['Pixel 7'], startHotel: 'chocohotel' },
  { name: 'windows-chromium', engine: chromium, context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, startHotel: 'brigantino' },
]

for (const scenario of scenarios) await exerciseScenario(scenario)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('FUNCTIONAL E2E OK: shell autenticata offline, 3 hotel, switch struttura persistente, nav <=5 e launcher Segnalazioni/Planning lavori/Planning sale su iOS WebKit, Android Chromium e Windows Chromium')
}
