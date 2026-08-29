import assert from 'node:assert/strict'
import { inflateSync } from 'node:zlib'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, webkit, devices } from 'playwright'

const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173'
const update = process.env.VISUAL_UPDATE === '1'
const baselineUrl = new URL('./visual-baseline.json', import.meta.url)
const artifacts = new URL('./artifacts/visual/', import.meta.url)
await mkdir(artifacts, { recursive: true })

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex')
  assert.equal(signature, '89504e470d0a1a0a', 'Screenshot PNG non valido')
  let offset = 8
  let width = 0; let height = 0; let bitDepth = 0; let colorType = 0
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset); offset += 4
    const type = buffer.subarray(offset, offset + 4).toString('ascii'); offset += 4
    const data = buffer.subarray(offset, offset + length); offset += length + 4
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
    if (type === 'IDAT') idat.push(data)
    if (type === 'IEND') break
  }
  assert.equal(bitDepth, 8, 'PNG bit depth inatteso')
  assert.ok(colorType === 2 || colorType === 6, `PNG color type ${colorType} non supportato`)
  const bpp = colorType === 6 ? 4 : 3
  const stride = width * bpp
  const raw = inflateSync(Buffer.concat(idat))
  const pixels = Buffer.alloc(height * stride)
  let src = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[src++]
    const row = raw.subarray(src, src + stride); src += stride
    const out = pixels.subarray(y * stride, (y + 1) * stride)
    const prev = y ? pixels.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[x - bpp] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= bpp ? prev[x - bpp] : 0
      const v = row[x]
      if (filter === 0) out[x] = v
      else if (filter === 1) out[x] = (v + a) & 255
      else if (filter === 2) out[x] = (v + b) & 255
      else if (filter === 3) out[x] = (v + Math.floor((a + b) / 2)) & 255
      else if (filter === 4) {
        const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c)
        out[x] = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      } else throw new Error(`Filtro PNG ${filter} non supportato`)
    }
  }
  return { width, height, bpp, pixels }
}

function signature(buffer, grid = 12) {
  const { width, height, bpp, pixels } = decodePng(buffer)
  const values = []
  for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
    const x0 = Math.floor(gx * width / grid); const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * width / grid))
    const y0 = Math.floor(gy * height / grid); const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * height / grid))
    let r = 0; let g = 0; let b = 0; let n = 0
    const stepX = Math.max(1, Math.floor((x1 - x0) / 6)); const stepY = Math.max(1, Math.floor((y1 - y0) / 6))
    for (let y = y0; y < y1; y += stepY) for (let x = x0; x < x1; x += stepX) {
      const i = y * width * bpp + x * bpp; r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++
    }
    values.push(Math.round(r / n), Math.round(g / n), Math.round(b / n))
  }
  return { width, height, grid, values }
}

function distance(a, b) {
  assert.equal(a.width, b.width, 'Larghezza screenshot cambiata')
  assert.equal(a.height, b.height, 'Altezza screenshot cambiata')
  assert.equal(a.grid, b.grid, 'Griglia visuale cambiata')
  assert.equal(a.values.length, b.values.length, 'Firma visuale incompatibile')
  let total = 0; let max = 0
  for (let i = 0; i < a.values.length; i++) { const d = Math.abs(a.values[i] - b.values[i]); total += d; if (d > max) max = d }
  return { mean: total / a.values.length, max }
}

async function stabilize(page) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} html{scroll-behavior:auto!important}' })
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
  await page.waitForTimeout(150)
}

async function seedOfflineShell(page, context, hotelId, uiSize = 'normal') {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate(async ({ hotelId, uiSize }) => {
    localStorage.setItem('apicehotel.theme.v1', 'dark')
    localStorage.setItem('apicehotel.ui-size.v1', uiSize)
    localStorage.setItem('apicehotel.session.v1', JSON.stringify({ hotelId, userId: 'visual-admin', createdAt: Date.now() }))
    const hotels = ['hotelgio', 'chocohotel', 'brigantino']
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
        const tx = db.transaction('cache', 'readwrite'); const store = tx.objectStore('cache')
        for (const id of hotels) store.put({ key: `directory:${id}`, entity: 'directory', hotelId: id, updatedAt: Date.now(), items: [{ id: 'visual-admin', legacy_id: 'visual-admin', auth_user_id: 'visual-admin', name: 'Visual Admin', role: 'admin', hotels }] })
        tx.oncomplete = () => { db.close(); resolve() }; tx.onerror = () => reject(tx.error)
      }
    })
  }, { hotelId, uiSize })
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByTestId('main-content').waitFor({ state: 'visible', timeout: 15000 })
  await page.getByTestId('hotel-chip').getByText(/Hotel Giò|ChocoHotel|Hotel Il Brigantino/).waitFor({ state: 'visible' })
}

const scenarios = [
  { name: 'login-ios-webkit', engine: webkit, context: devices['iPhone 13'], state: 'login' },
  { name: 'login-android-chromium', engine: chromium, context: devices['Pixel 7'], state: 'login' },
  { name: 'login-windows-chromium', engine: chromium, context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, state: 'login' },
  { name: 'home-gio-ios-webkit', engine: webkit, context: devices['iPhone 13'], state: 'home', hotelId: 'hotelgio' },
  { name: 'home-choco-android-chromium', engine: chromium, context: devices['Pixel 7'], state: 'home', hotelId: 'chocohotel' },
  { name: 'home-brigantino-windows-chromium', engine: chromium, context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, state: 'home', hotelId: 'brigantino' },
  { name: 'home-gio-large-ios-webkit', engine: webkit, context: devices['iPhone 13'], state: 'home', hotelId: 'hotelgio', uiSize: 'large' },
]

const current = {}
const failures = []
for (const scenario of scenarios) {
  const browser = await scenario.engine.launch({ headless: true })
  const context = await browser.newContext(scenario.context)
  const page = await context.newPage()
  try {
    if (scenario.state === 'login') {
      await page.addInitScript(() => { localStorage.setItem('apicehotel.theme.v1', 'dark'); localStorage.setItem('apicehotel.ui-size.v1', 'normal'); localStorage.removeItem('apicehotel.session.v1') })
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: 'Bentornato' }).waitFor({ state: 'visible' })
    } else {
      await seedOfflineShell(page, context, scenario.hotelId, scenario.uiSize || 'normal')
      assert.equal(await page.getByTestId('bottom-nav').isVisible(), scenario.context.viewport?.width >= 1024 ? false : true)
      if (await page.getByTestId('fab-new').isVisible().catch(() => false)) {
        await page.getByTestId('fab-new').click()
        await page.getByText(/Nuovo|inserimento/i).first().waitFor({ state: 'visible' })
        await page.keyboard.press('Escape').catch(() => {})
      }
    }
    await stabilize(page)
    const shot = await page.screenshot({ path: fileURLToPath(new URL(`${scenario.name}.png`, artifacts)), fullPage: false })
    current[scenario.name] = signature(shot)
  } catch (error) { failures.push(`${scenario.name}: ${error.message}`) }
  finally { await context.close(); await browser.close() }
}

if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
if (update) {
  await writeFile(baselineUrl, `${JSON.stringify({ version: 1, thresholdMean: 7, scenarios: current }, null, 2)}\n`)
  console.log('VISUAL_BASELINE_BEGIN')
  console.log(await readFile(baselineUrl, 'utf8'))
  console.log('VISUAL_BASELINE_END')
  console.log(`Visual baseline aggiornata: ${Object.keys(current).length} scenari`)
  process.exit(0)
}

let baseline
try { baseline = JSON.parse(await readFile(baselineUrl, 'utf8')) } catch { throw new Error('Baseline visuale mancante: eseguire VISUAL_UPDATE=1 npm run test:visual e revisionare il risultato') }
assert.equal(baseline.version, 1, 'Versione baseline visuale non supportata')
for (const [name, sig] of Object.entries(current)) {
  assert.ok(baseline.scenarios[name], `Scenario visuale ${name} assente dalla baseline`)
  const diff = distance(sig, baseline.scenarios[name])
  if (diff.mean > baseline.thresholdMean) failures.push(`${name}: regressione visuale mean=${diff.mean.toFixed(2)} > ${baseline.thresholdMean}, max=${diff.max}`)
}
if (Object.keys(baseline.scenarios).length !== Object.keys(current).length) failures.push('La baseline contiene scenari non più eseguiti')
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`VISUAL REGRESSION OK: ${Object.keys(current).length} baseline percettive, iOS/WebKit + Android/Chromium + Windows/Chromium, login + shell autenticata + modalità Grande`)
