export const RANDUI_MOTION_VERSION = '1.0.0'

export const RANDUI_MOTION = Object.freeze({
  duration: Object.freeze({
    instant: 80,
    fast: 160,
    standard: 220,
    emphasis: 320,
  }),
  easing: Object.freeze({
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    enter: 'cubic-bezier(0, 0, 0, 1)',
    exit: 'cubic-bezier(0.3, 0, 1, 1)',
    emphasis: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  }),
})

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function resolveRandUiMotion(name = 'standard', { reducedMotion = prefersReducedMotion() } = {}) {
  if (reducedMotion) {
    return Object.freeze({ duration: 0, easing: RANDUI_MOTION.easing.standard })
  }

  const duration = RANDUI_MOTION.duration[name] ?? RANDUI_MOTION.duration.standard
  const easing = RANDUI_MOTION.easing[name] ?? RANDUI_MOTION.easing.standard
  return Object.freeze({ duration, easing })
}
