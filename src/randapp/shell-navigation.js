import { interestsForNavItem, rankAuthorizedNavigation } from './adaptive-layout.js'

// RandUI Telegram-inspired primary navigation contract.
// Five spatial slots stay stable on mobile: Operatività, Planning, Home, a
// contextual fast destination, RandAI. Home is always the geometric centre and
// RandAI owns the far-right slot. The complete navigation lives in the profile
// drawer instead of an "Altro" catch-all tab.

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

function firstContextualDestination({ placement, viewAllowed, interests }) {
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

export function buildPrimaryBottomNav({ placement, viewAllowed, interests = [] }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

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

  // RandAI is a global assistant action, not a page destination. Keeping it as
  // an action avoids duplicating the /randai console or bypassing its own auth.
  items.push({ slot: TELEGRAM_PRIMARY_SLOTS.randai, id: 'randai', key: 'randai', icon: 'sparkles', label: 'RandAI', action: 'randai' })

  return items
}

export function isPrimaryBottomDestination(view) {
  return view === 'operations' || view === 'home' || view === 'planning-work' || view === 'chat' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
