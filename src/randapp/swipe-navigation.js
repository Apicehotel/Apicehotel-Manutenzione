const DEFAULTS = Object.freeze({
  minDistance: 72,
  maxVerticalDrift: 48,
  minHorizontalRatio: 1.45,
  edgeExclusion: 18,
})

export function classifyHorizontalSwipe(start, end, options = {}) {
  if (!start || !end) return null
  const config = { ...DEFAULTS, ...options }
  const dx = Number(end.x) - Number(start.x)
  const dy = Number(end.y) - Number(start.y)
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null
  if (start.x <= config.edgeExclusion) return null
  if (absX < config.minDistance) return null
  if (absY > config.maxVerticalDrift) return null
  if (absX < absY * config.minHorizontalRatio) return null

  return dx < 0 ? 'left' : 'right'
}

export function isInteractiveGestureTarget(target) {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  return Boolean(target.closest('input, textarea, select, button, a, [contenteditable="true"], [role="slider"], [data-swipe-lock]'))
}

export function createSwipeTracker({ onSwipeLeft, onSwipeRight, options } = {}) {
  let start = null

  return {
    start(event) {
      const touch = event.touches?.[0]
      if (!touch || isInteractiveGestureTarget(event.target)) {
        start = null
        return
      }
      start = { x: touch.clientX, y: touch.clientY }
    },
    end(event) {
      if (!start) return null
      const touch = event.changedTouches?.[0]
      const initial = start
      start = null
      if (!touch) return null
      const direction = classifyHorizontalSwipe(initial, { x: touch.clientX, y: touch.clientY }, options)
      if (direction === 'left') onSwipeLeft?.()
      if (direction === 'right') onSwipeRight?.()
      return direction
    },
    cancel() { start = null },
  }
}

let installed = false
export function installSwipeMenuGesture() {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  installed = true
  const tracker = createSwipeTracker({
    onSwipeLeft: () => {
      if (document.querySelector('.rs-overlay, [role="dialog"]')) return
      document.querySelector('[data-testid="nav-menu"]')?.click()
    },
  })
  const start = (event) => tracker.start(event)
  const end = (event) => tracker.end(event)
  const cancel = () => tracker.cancel()
  document.addEventListener('touchstart', start, { passive: true })
  document.addEventListener('touchend', end, { passive: true })
  document.addEventListener('touchcancel', cancel, { passive: true })
  return () => {
    document.removeEventListener('touchstart', start)
    document.removeEventListener('touchend', end)
    document.removeEventListener('touchcancel', cancel)
    installed = false
  }
}

export const SWIPE_NAV_DEFAULTS = DEFAULTS
