import { readFileSync, writeFileSync } from 'node:fs'

// Applica la sistemazione definitiva del menu laterale e la pulizia cache.
const path = 'src/randapp/Shell.jsx'
let s = readFileSync(path, 'utf8')

s = s.replace("  const [settings, setSettings] = useState(null)\n", "  const [settings, setSettings] = useState(null)\n  const [cacheBusy, setCacheBusy] = useState(false)\n  const [cacheStatus, setCacheStatus] = useState('')\n")

s = s.replace("  const openHomePersonalize = () => {\n    setDrawer(false)\n    setView('home')\n    setPersonalizeSignal((n) => n + 1)\n  }\n", "  const openHomePersonalize = () => {\n    setDrawer(false)\n    setView('home')\n    setPersonalizeSignal((n) => n + 1)\n  }\n\n  const clearAppCache = async () => {\n    if (cacheBusy) return\n    const ok = window.confirm('Pulisci la cache dell’app? Sessione, PIN e preferenze resteranno invariati.')\n    if (!ok) return\n    setCacheBusy(true)\n    setCacheStatus('Pulizia…')\n    try {\n      if ('caches' in window) {\n        const keys = await caches.keys()\n        await Promise.all(keys.map((key) => caches.delete(key)))\n      }\n      if ('serviceWorker' in navigator) {\n        const registrations = await navigator.serviceWorker.getRegistrations()\n        await Promise.all(registrations.map((registration) => registration.update().catch(() => undefined)))\n      }\n      setCacheStatus('Cache pulita')\n      window.setTimeout(() => window.location.reload(), 500)\n    } catch (error) {\n      console.error('Cache cleanup failed', error)\n      setCacheStatus('Errore pulizia')\n      setCacheBusy(false)\n    }\n  }\n")

s = s.replace("              <span className=\"rs-sidebar__label\">Dimensione interfaccia</span>\n              <UiSizeControl />\n", "              <span className=\"rs-sidebar__label\">Dimensione interfaccia</span>\n              <UiSizeControl />\n              <span className=\"rs-sidebar__label\">Sistema</span>\n              <button className=\"rs-sidebar__item\" onClick={clearAppCache} disabled={cacheBusy} data-testid=\"sidebar-clear-cache\"><Icon name=\"refresh\" /> <span>{cacheStatus || 'Pulisci cache'}</span></button>\n")

s = s.replace("              <div className=\"rs-drawer__setting\"><small>Dimensione interfaccia</small><UiSizeControl /></div>\n", "              <div className=\"rs-drawer__setting\"><small>Dimensione interfaccia</small><UiSizeControl /></div>\n              <span className=\"rs-drawer__label\">Sistema</span>\n              <button className=\"rs-drawer__item\" onClick={clearAppCache} disabled={cacheBusy} data-testid=\"drawer-clear-cache\">\n                <Icon name=\"refresh\" /> <span>{cacheStatus || 'Pulisci cache'}</span><i><Icon name=\"chevronRight\" /></i>\n              </button>\n")

if (!s.includes('drawer-clear-cache') || !s.includes('sidebar-clear-cache')) throw new Error('Patch cache menu non applicata')
writeFileSync(path, s)
