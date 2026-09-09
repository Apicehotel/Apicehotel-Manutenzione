import { rankAuthorizedNavigation } from './adaptive-layout.js'

// RandUI primary mobile navigation contract.
// Five spatial slots stay stable on mobile: Operatività, Planning, Home, Task,
// RandAI. Home is always the geometric centre and RandAI owns the far-right
// slot. Task is the default operational shortcut; role configuration can select
// another authorized destination without changing the surrounding slots.

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

export const CONTEXTUAL_NAV = Object.freeze([
  Object.freeze({ id: 'my-work', key: 'interventions', icon: 'check', label: 'Task' }),
  Object.freeze({ id: 'chat', key: 'chat', icon: 'message', label: 'Chat' }),
  ...PRIMARY_OPERATIONAL_NAV,
])


export function supportsBottomPlacement(key) {
  return key === 'home' || key === 'planning_work' || CONTEXTUAL_NAV.some((item) => item.key === key)
}

// A role can explicitly choose one contextual shortcut. Existing configurations
// with several preferences retain deterministic, permission-aware ranking.
export function withNavigationPlacement(config, role, key, value, placement) {
  const next = { ...config?.[role], [key]: value }
  if (value === 'bottom' && CONTEXTUAL_NAV.some((item) => item.key === key)) {
    for (const item of CONTEXTUAL_NAV) {
      if (item.key !== key && placement(item.key) === 'bottom') next[item.key] = 'side'
    }
  }
  return { ...config, [role]: next }
}

function firstContextualDestination({ placement, viewAllowed, interests }) {
  const preferred = CONTEXTUAL_NAV.filter((item) => placement(item.key) === 'bottom' && viewAllowed(item.id))
  const task = preferred.find((item) => item.id === 'my-work')
  const ranked = task ? [task] : rankAuthorizedNavigation(preferred, interests)
  return ranked[0] ? { ...ranked[0], slot: TELEGRAM_PRIMARY_SLOTS.contextual } : null
}

export function buildPrimaryBottomNav({ placement, viewAllowed, interests = [] }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

  const items = []
  const operationsVisible = viewAllowed('operations')
  const planningVisible = placement('planning_work') === 'bottom' && viewAllowed('planning-work')
  const homeVisible = placement('home') === 'bottom' && viewAllowed('home')

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
  return view === 'operations' || view === 'home' || view === 'planning-work' || view === 'my-work' || view === 'chat' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
