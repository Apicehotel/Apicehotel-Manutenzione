const { contextBridge, ipcRenderer } = require('electron')

const CHANNELS = Object.freeze({
  printers: 'randdesktop:print:printers',
  current: 'randdesktop:print:current',
  document: 'randdesktop:print:document',
})

contextBridge.exposeInMainWorld('randDesktop', Object.freeze({
  platform: process.platform,
  print: Object.freeze({
    listPrinters: () => ipcRenderer.invoke(CHANNELS.printers),
    current: () => ipcRenderer.invoke(CHANNELS.current),
    document: (document) => ipcRenderer.invoke(CHANNELS.document, document),
  }),
}))
