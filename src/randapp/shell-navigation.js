import { interestsForNavItem, rankAuthorizedNavigation } from './adaptive-layout.js'

// RandUI primary mobile navigation contract.
// The shell owns at most five stable spatial slots. Home stays in the geometric
// centre when available, while the other destinations are resolved from role
// configuration + effective permissions. Slot 4 is intentionally contextual:
// Task/Promemoria is the default candidate, but any configured/authorized
// destination can replace it without leaving an empty hole.

export const PRIMARY_OPERATIONAL_NAV = Object.freeze([
  Object.freeze({ id: 'inventory', key: 'inventory', icon: 'package', label: 'Magazzino' }),
  Object.freeze({ id: 'supplies', key: 'supplies', icon: 'package', label: 'Rifornimenti' }),
  Object.freeze({ id: 'urgent', key: 'urgent', icon: 'warning', label: 'Urgenti' }),
  Object.freeze({ id: 'housekeeping', key: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' }),
])

export const CONTEXTUAL_PRIMARY_NAV = Object.freeze([
  Object.freeze({ id: 'reminders', key: 'reminders', icon: 'check', label: 'Task' }),
  Object.freeze({ id: 'chat', key: 'chat', icon: 'message', label: 'Chat' }),
  ...PRIMARY_OPERATIONAL_NAV,
])

export const TELEGRAM_PRIMARY_SLOTS = Object.freeze({
  operations: 1,
  planning: 2,
  home: 3,
  contextual: 4,
  randai: 5,
})

function firstContextualDestination({ placement, viewAllowed, interests }) {
  const authorized = CONTEXTUAL_PRIMARY_NAV.filter((item) => placement(item.key) !== 'off' && viewAllowed(item.id))
  const preferred = authorized.filter((item) => placement(item.key) === 'bottom')
  const secondary = authorized.filter((item) => placement(item.key) !== 'bottom')
  const configuredInterestTags = preferred.flatMap((item) => interestsForNavItem(item.id))
  const effectiveInterests = interests.length ? interests : configuredInterestTags
  const ranked = [
    ...rankAuthorizedNavigation(preferred, effectiveInterests),
    ...rankAuthorizedNavigation(secondary, effectiveInterests),
  ]
  return ranked[0] ? { ...ranked[0], slot: TELEGRAM_PRIMARY_SLOTS.contextual } : null
}

export function buildPrimaryBottomNav({ placement, viewAllowed, interests = [] }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

  const items = []
  const operationsVisible = viewAllowed('operations')
  const planningVisible = placement('planning_work') !== 'off' && viewAllowed('planning-work')
  const homeVisible = placement('home') !== 'off' && viewAllowed('home')
  const randaiVisible = placement('randai') !== 'off' && viewAllowed('randai')

  if (operationsVisible) {
    items.push({ slot: TELEGRAM_PRIMARY_SLOTS.operations, id: 'operations', key: 'operations', icon: 'issues', label: 'Operatività' })
  }
  if (planningVisible) {
    items.push({ slot: TELEGRAM_PRIMARY_SLOTS.planning, id: 'planning-work', key: 'planning_work', icon: 'calendar', label: 'Planning' })
  }
  if (homeVisible) {
    items.push({ slot: TELEGRAM_PRIMARY_SLOTS.home, id: 'home', key: 'home', icon: 'home', label: 'Home' })
  }

  const contextual = firstContextualDestination({ placement, viewAllowed, interests })
  if (contextual) items.push(contextual)

  if (randaiVisible) {
    items.push({ slot: TELEGRAM_PRIMARY_SLOTS.randai, id: 'randai', key: 'randai', icon: 'sparkles', label: 'RandAI' })
  }

  return items.slice(0, 5)
}

export function isPrimaryBottomDestination(view) {
  return view === 'operations' || view === 'home' || view === 'planning-work' || view === 'chat' || view === 'reminders' || view === 'randai' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
