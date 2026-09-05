// RandUI adaptive layout contract.
// Permissions remain authoritative; interests only rank and prioritize authorized UI.

export const DEVICE_CLASS = Object.freeze({ MOBILE: 'mobile', TABLET: 'tablet', DESKTOP: 'desktop' })
export const INPUT_MODE = Object.freeze({ TOUCH: 'touch', POINTER: 'pointer' })
export const ORIENTATION = Object.freeze({ PORTRAIT: 'portrait', LANDSCAPE: 'landscape' })

const ROLE_INTERESTS = Object.freeze({
  manutentore: ['maintenance', 'issues', 'inventory', 'planning'],
  manutenzione: ['maintenance', 'issues', 'inventory', 'planning'],
  facchino: ['planning', 'issues', 'supplies'],
  reception: ['issues', 'communications', 'planning'],
  receptionist: ['issues', 'communications', 'planning'],
  direzione: ['overview', 'issues', 'planning', 'administration'],
  direttore: ['overview', 'issues', 'planning', 'administration'],
  admin: ['overview', 'administration', 'issues', 'maintenance'],
})

const NAV_INTERESTS = Object.freeze({
  home: ['overview'],
  issues: ['issues', 'maintenance', 'communications'],
  interventions: ['maintenance', 'issues'],
  inventory: ['inventory', 'maintenance'],
  supplies: ['supplies', 'housekeeping'],
  'planning-work': ['planning', 'maintenance'],
  housekeeping: ['housekeeping', 'supplies'],
  urgent: ['communications', 'issues'],
  reminders: ['planning', 'maintenance'],
  temperature: ['maintenance'],
  plants: ['maintenance'],
  technicians: ['maintenance'],
  profile: ['account'],
  manual: ['account', 'maintenance'],
  feedback: ['account'],
})

const clean = (value) => String(value || '').trim().toLowerCase()

export function interestsForNavItem(itemId) {
  return [...(NAV_INTERESTS[itemId] || [])]
}

export function resolveUserInterests(user) {
  const explicit = Array.isArray(user?.interests) ? user.interests.map(clean).filter(Boolean) : []
  if (explicit.length) return Array.from(new Set(explicit))
  return ROLE_INTERESTS[clean(user?.role)] || ['overview', 'issues']
}

export function interestScore(itemId, interests = []) {
  const wanted = NAV_INTERESTS[itemId] || []
  if (!wanted.length) return 0
  const normalized = new Set(interests.map(clean))
  return wanted.reduce((score, tag) => score + (normalized.has(tag) ? 10 : 0), 0)
}

export function resolveAdaptiveLayout({ width = 0, height = 0, touch = false, uiSize = 'normal' } = {}) {
  const device = width >= 1200 ? DEVICE_CLASS.DESKTOP : width >= 768 ? DEVICE_CLASS.TABLET : DEVICE_CLASS.MOBILE
  const orientation = width > height ? ORIENTATION.LANDSCAPE : ORIENTATION.PORTRAIT
  const input = touch ? INPUT_MODE.TOUCH : INPUT_MODE.POINTER
  const density = ['small', 'normal', 'large'].includes(uiSize) ? uiSize : 'normal'
  return Object.freeze({
    device,
    orientation,
    input,
    density,
    useSidebar: device === DEVICE_CLASS.DESKTOP,
    useBottomNav: device !== DEVICE_CLASS.DESKTOP,
    compactChrome: device === DEVICE_CLASS.MOBILE || (device === DEVICE_CLASS.TABLET && orientation === ORIENTATION.PORTRAIT),
    touchOptimized: input === INPUT_MODE.TOUCH,
  })
}

export function rankAuthorizedNavigation(items, interests = []) {
  return [...items]
    .map((item, index) => ({ item, index, score: interestScore(item.id, interests) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ item }) => item)
}
