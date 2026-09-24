// Canonical bridge between CSS safe areas, browser VisualViewport and an optional native shell.
// Components consume CSS tokens only; they never own device-specific viewport math.

const SIDES = ['top', 'right', 'bottom', 'left']
const VISUAL_PROPS = ['--rs-visual-viewport-height', '--rs-visual-viewport-width', '--rs-visual-viewport-offset-top']

function toPixels(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? `${number}px` : '0px'
}

export function applySystemInsets(insets = {}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  SIDES.forEach((side) => {
    root.style.setProperty(`--rs-native-safe-${side}`, toPixels(insets[side]))
  })
  root.dataset.systemInsets = 'native'
}

export function clearSystemInsets() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  SIDES.forEach((side) => root.style.removeProperty(`--rs-native-safe-${side}`))
  delete root.dataset.systemInsets
}

export function clearVisualViewportState() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  VISUAL_PROPS.forEach((name) => root.style.removeProperty(name))
  delete root.dataset.keyboardOpen
  delete root.dataset.viewportOrientation
}

export function syncVisualViewportState(win = globalThis.window) {
  if (!win || typeof document === 'undefined') return
  const root = document.documentElement
  const viewport = win.visualViewport
  const height = Math.round(viewport?.height || win.innerHeight || 0)
  const width = Math.round(viewport?.width || win.innerWidth || 0)
  const offsetTop = Math.max(0, Math.round(viewport?.offsetTop || 0))
  const layoutHeight = Math.max(0, Math.round(win.innerHeight || height))

  root.style.setProperty('--rs-visual-viewport-height', `${height}px`)
  root.style.setProperty('--rs-visual-viewport-width', `${width}px`)
  root.style.setProperty('--rs-visual-viewport-offset-top', `${offsetTop}px`)

  const keyboardDelta = layoutHeight - height
  const keyboardOpen = keyboardDelta >= 120 && height < layoutHeight * 0.86
  root.dataset.keyboardOpen = keyboardOpen ? 'true' : 'false'
  root.dataset.viewportOrientation = width > height ? 'landscape' : 'portrait'
}

export function initSystemInsetsBridge() {
  if (typeof window === 'undefined') return () => {}

  const bootstrap = window.__RANDAPP_NATIVE_INSETS__
  if (bootstrap && typeof bootstrap === 'object') applySystemInsets(bootstrap)

  const onInsets = (event) => {
    if (event?.detail && typeof event.detail === 'object') applySystemInsets(event.detail)
  }
  const sync = () => syncVisualViewportState(window)
  const visualViewport = window.visualViewport

  window.addEventListener('randapp-system-insets', onInsets)
  window.addEventListener('resize', sync, { passive: true })
  window.addEventListener('orientationchange', sync, { passive: true })
  visualViewport?.addEventListener('resize', sync, { passive: true })
  visualViewport?.addEventListener('scroll', sync, { passive: true })
  sync()

  return () => {
    window.removeEventListener('randapp-system-insets', onInsets)
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
    visualViewport?.removeEventListener('resize', sync)
    visualViewport?.removeEventListener('scroll', sync)
    clearVisualViewportState()
  }
}
