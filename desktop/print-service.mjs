import { renderPrintDocumentHtml } from './print-template.mjs'

const CURRENT_VIEW_PRINT_CSS = `
@media print {
  html, body { background: #fff !important; color: #111 !important; overflow: visible !important; }
  .rs-overlay { background: #fff !important; position: static !important; inset: auto !important; padding: 0 !important; }
  body:has(.rs-overlay .rs-sheet) * { visibility: hidden !important; }
  body:has(.rs-overlay .rs-sheet) .rs-overlay,
  body:has(.rs-overlay .rs-sheet) .rs-overlay * { visibility: visible !important; }
  body:has(.rs-overlay .rs-sheet) .rs-sheet {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    box-shadow: none !important;
    border: 0 !important;
    border-radius: 0 !important;
  }
  .rs-sheet__handle,
  .rs-bottom-nav,
  .rs-bottomnav,
  .rs-fab,
  [data-print-hide="true"] { display: none !important; }
  button, input, select, textarea { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`

function ensureWindow(window) {
  if (!window || window.isDestroyed?.() || !window.webContents || window.webContents.isDestroyed?.()) {
    throw new Error('Finestra RandDesktop non disponibile')
  }
}

function printWebContents(webContents, options = {}) {
  const printOptions = {
    silent: false,
    printBackground: true,
    usePrinterDefaultPageSize: true,
    landscape: Boolean(options.landscape),
  }
  return new Promise((resolve, reject) => {
    webContents.print(printOptions, (success, failureReason) => {
      if (success) resolve({ ok: true })
      else reject(new Error(failureReason || 'Stampa non riuscita'))
    })
  })
}

export async function listPrinters(window) {
  ensureWindow(window)
  const printers = await window.webContents.getPrintersAsync()
  return printers.map((printer) => ({
    name: printer.name,
    displayName: printer.displayName || printer.name,
    description: printer.description || '',
    status: printer.status ?? null,
    isDefault: Boolean(printer.isDefault),
  }))
}

export async function printCurrentView(window) {
  ensureWindow(window)
  const cssKey = await window.webContents.insertCSS(CURRENT_VIEW_PRINT_CSS, { cssOrigin: 'user' })
  try {
    return await printWebContents(window.webContents)
  } finally {
    if (cssKey && !window.webContents.isDestroyed()) await window.webContents.removeInsertedCSS(cssKey).catch(() => {})
  }
}

export async function printStructuredDocument({ BrowserWindow, ownerWindow, document }) {
  ensureWindow(ownerWindow)
  const html = renderPrintDocumentHtml(document)
  const printWindow = new BrowserWindow({
    show: false,
    parent: ownerWindow,
    width: 900,
    height: 1100,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await printWebContents(printWindow.webContents)
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
  }
}
