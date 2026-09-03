// Bridge between web safe-area env() values and an optional future native shell.
// Today PWA/iOS/Android browsers use CSS env(safe-area-inset-*).
// A future Capacitor wrapper can dispatch `randapp-system-insets` with pixel values
// without changing any RandApp component.

const SIDES = ['top', 'right', 'bottom', 'left']

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

export function initSystemInsetsBridge() {
  if (typeof window === 'undefined') return () => {}

  const bootstrap = window.__RANDAPP_NATIVE_INSETS__
  if (bootstrap && typeof bootstrap === 'object') applySystemInsets(bootstrap)

  const onInsets = (event) => {
    if (event?.detail && typeof event.detail === 'object') applySystemInsets(event.detail)
  }

  const visualViewport = window.visualViewport
  const syncVisualViewport = () => {
    if (!visualViewport) return
    document.documentElement.style.setProperty('--rs-visual-viewport-height', `${Math.round(visualViewport.height)}px`)
    document.documentElement.dataset.keyboardOpen = visualViewport.height < window.innerHeight * 0.78 ? 'true' : 'false'
  }

  window.addEventListener('randapp-system-insets', onInsets)
  visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true })
  visualViewport?.addEventListener('scroll', syncVisualViewport, { passive: true })
  syncVisualViewport()
  return () => {
    window.removeEventListener('randapp-system-insets', onInsets)
    visualViewport?.removeEventListener('resize', syncVisualViewport)
    visualViewport?.removeEventListener('scroll', syncVisualViewport)
  }
}
