import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizePrintDocument, renderPrintDocumentHtml } from '../desktop/print-template.mjs'
import { listPrinters, printCurrentView, printStructuredDocument } from '../desktop/print-service.mjs'

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function makeWebContents() {
  const calls = { print: [], inserted: [], removed: [] }
  return {
    calls,
    isDestroyed: () => false,
    getPrintersAsync: async () => [{ name: 'Office_Printer', displayName: 'Office Printer', description: 'Reception', status: 0, isDefault: true, options: { secret: 'not exposed' } }],
    insertCSS: async (css) => { calls.inserted.push(css); return 'css-key' },
    removeInsertedCSS: async (key) => { calls.removed.push(key) },
    print: (options, callback) => { calls.print.push(options); callback(true, '') },
  }
}

function makeOwnerWindow(webContents = makeWebContents()) {
  return { webContents, isDestroyed: () => false }
}

test('template di stampa è strutturato, limitato ed escape-a HTML non fidato', () => {
  const doc = normalizePrintDocument({
    title: 'Segnalazione <script>alert(1)</script>',
    metadata: [{ label: 'Camera', value: '<img src=x onerror=alert(1)>' }],
    sections: [{ heading: 'Problema', text: '<b>lampadina</b>' }],
  })
  assert.match(doc.title, /Segnalazione/)
  const html = renderPrintDocumentHtml(doc)
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /default-src 'none'/)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /&lt;img src=x/)
})

test('stampa corrente usa sempre dialog utente e pagina predefinita della stampante', async () => {
  const webContents = makeWebContents()
  await printCurrentView(makeOwnerWindow(webContents))
  assert.equal(webContents.calls.print.length, 1)
  assert.equal(webContents.calls.print[0].silent, false)
  assert.equal(webContents.calls.print[0].usePrinterDefaultPageSize, true)
  assert.equal(webContents.calls.print[0].printBackground, true)
  assert.equal(webContents.calls.removed[0], 'css-key')
})

test('elenco stampanti non espone options o proprietà non necessarie del driver', async () => {
  const result = await listPrinters(makeOwnerWindow())
  assert.deepEqual(result, [{ name: 'Office_Printer', displayName: 'Office Printer', description: 'Reception', status: 0, isDefault: true }])
})

test('documento strutturato viene stampato in finestra sandbox senza HTML arbitrario', async () => {
  let instance
  class FakeBrowserWindow {
    constructor(options) {
      this.options = options
      this.webContents = makeWebContents()
      this.destroyed = false
      instance = this
    }
    async loadURL(url) { this.url = url }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
  }
  const result = await printStructuredDocument({
    BrowserWindow: FakeBrowserWindow,
    ownerWindow: makeOwnerWindow(),
    document: { title: 'Segnalazione 214', sections: [{ heading: 'Problema', text: '<script>boom</script>' }] },
  })
  assert.equal(result.ok, true)
  assert.equal(instance.options.show, false)
  assert.equal(instance.options.webPreferences.nodeIntegration, false)
  assert.equal(instance.options.webPreferences.contextIsolation, true)
  assert.equal(instance.options.webPreferences.sandbox, true)
  assert.equal(instance.options.webPreferences.webSecurity, true)
  const decoded = decodeURIComponent(instance.url.split(',')[1])
  assert.doesNotMatch(decoded, /<script>boom<\/script>/)
  assert.match(decoded, /&lt;script&gt;boom&lt;\/script&gt;/)
  assert.equal(instance.destroyed, true)
})

test('preload non espone ipcRenderer e main valida sender + shell locale in produzione', () => {
  const preload = read('desktop/preload.mjs')
  const main = read('desktop/main.mjs')
  assert.match(preload, /contextBridge\.exposeInMainWorld\('randDesktop'/)
  assert.doesNotMatch(preload, /ipcRenderer\s*[,}]/)
  assert.match(main, /event\.sender === mainWindow\.webContents/)
  assert.match(main, /nodeIntegration: false/)
  assert.match(main, /contextIsolation: true/)
  assert.match(main, /sandbox: true/)
  assert.match(main, /process\.resourcesPath, 'app', 'index\.html'/)
  assert.doesNotMatch(main, /https:\/\/apicehotel\.vercel\.app/)
})

test('RandDesktop blocca stampa silenziosa dal contratto v1', () => {
  const preload = read('desktop/preload.mjs')
  const service = read('desktop/print-service.mjs')
  assert.doesNotMatch(preload, /silent/)
  assert.match(service, /silent: false/)
  assert.doesNotMatch(service, /deviceName/)
})
