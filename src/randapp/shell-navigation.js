import { interestsForNavItem, rankAuthorizedNavigation } from './adaptive-layout.js'

// RandUI primary mobile navigation contract.
// Five spatial slots stay stable on mobile: Operatività, Planning, Home, Task,
// RandAI. Home is always the geometric centre and RandAI owns the far-right
// slot. Task is the preferred operational destination; contextual fallbacks are
// used only for roles that cannot access interventions/my-work.

export const PRIMARY_OPERATIONAL_NAV = Object.freeze([
  Object.freeze({ id: 'inventory', key: 'inventory', icon: 'package', label: 'Magazzino' }),
  Object.freeze({ id: 'supplies', key: 'supplies', icon: 'package', label: 'Rifornimenti' }),
  Object.freeze({ id: 'urgent', key: 'urgent', icon: 'warning', label: 'Urgenti' }),
  Object.freeze({ id: 'housekeeping', key: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' }),
])

export const TELEGRAM_PRIMARY_SLOTS = Object.freeze({
  operations: 1,
  planning: 2,
  home: 3,
  contextual: 4,
  randai: 5,
})

const HOUSEKEEPING_ROLES = new Set(['Governante', 'Capo Governante'])

function firstContextualDestination({ placement, viewAllowed, interests }) {
  if (placement('interventions') !== 'off' && viewAllowed('my-work')) {
    return { id: 'my-work', key: 'interventions', icon: 'check', label: 'Task', slot: TELEGRAM_PRIMARY_SLOTS.contextual }
  }

  if (placement('chat') !== 'off' && viewAllowed('chat')) {
    return { id: 'chat', key: 'chat', icon: 'message', label: 'Chat', slot: TELEGRAM_PRIMARY_SLOTS.contextual }
  }

  const authorized = PRIMARY_OPERATIONAL_NAV.filter((item) => placement(item.key) !== 'off' && viewAllowed(item.id))
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

export function buildPrimaryBottomNav({ placement, viewAllowed, interests = [], user = null }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

  if (HOUSEKEEPING_ROLES.has(user?.role)) {
    return [
      viewAllowed('housekeeping') && { slot: 1, id: 'housekeeping', key: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' },
      viewAllowed('supplies') && { slot: 2, id: 'supplies', key: 'supplies', icon: 'package', label: 'Rifornimenti' },
      viewAllowed('home') && { slot: 3, id: 'home', key: 'home', icon: 'home', label: 'Home' },
      viewAllowed('my-work') && { slot: 4, id: 'my-work', key: 'task', icon: 'check', label: 'Task' },
    ].filter(Boolean)
  }

  const items = []
  const operationsVisible = viewAllowed('operations')
  const planningVisible = placement('planning_work') !== 'off' && viewAllowed('planning-work')
  const homeVisible = placement('home') !== 'off' && viewAllowed('home')

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

  // Bottom-nav RandAI opens the dedicated in-app chat page. Control Center
  // /randai stays a protected URL, not a primary-nav destination.
  items.push({ slot: TELEGRAM_PRIMARY_SLOTS.randai, id: 'randai', key: 'randai', icon: 'sparkles', label: 'RandAI' })

  return items
}

export function isPrimaryBottomDestination(view) {
  return view === 'operations' || view === 'home' || view === 'planning-work' || view === 'my-work' || view === 'chat' || view === 'randai' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
