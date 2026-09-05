import { app, BrowserWindow, Menu, ipcMain, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { listPrinters, printCurrentView, printStructuredDocument } from './print-service.mjs'

app.enableSandbox()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHANNELS = Object.freeze({
  printers: 'randdesktop:print:printers',
  current: 'randdesktop:print:current',
  document: 'randdesktop:print:document',
})

let mainWindow = null

function isTrustedSender(event) {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents)
}

function assertTrustedSender(event) {
  if (!isTrustedSender(event)) throw new Error('Richiesta RandDesktop non autorizzata')
}

async function loadRandApp(window) {
  if (!app.isPackaged) {
    const devUrl = process.env.RANDAPP_DEV_URL || 'http://localhost:5173'
    await window.loadURL(devUrl)
    return
  }
  await window.loadFile(path.join(process.resourcesPath, 'app', 'index.html'))
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => { if (mainWindow === window) mainWindow = null })
  return window
}

function installPrintingIpc() {
  ipcMain.handle(CHANNELS.printers, async (event) => {
    assertTrustedSender(event)
    return listPrinters(mainWindow)
  })
  ipcMain.handle(CHANNELS.current, async (event) => {
    assertTrustedSender(event)
    return printCurrentView(mainWindow)
  })
  ipcMain.handle(CHANNELS.document, async (event, document) => {
    assertTrustedSender(event)
    return printStructuredDocument({ BrowserWindow, ownerWindow: mainWindow, document })
  })
}

function installApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Stampa…',
          accelerator: 'CmdOrCtrl+P',
          click: () => { if (mainWindow) printCurrentView(mainWindow).catch((error) => console.error('[RandDesktop print]', error)) },
        },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Visualizza',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  installPrintingIpc()
  installApplicationMenu()
  mainWindow = createMainWindow()
  await loadRandApp(mainWindow)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length) return
    mainWindow = createMainWindow()
    await loadRandApp(mainWindow)
  })
}).catch((error) => {
  console.error('[RandDesktop startup]', error)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
