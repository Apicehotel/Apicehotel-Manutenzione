import { rankAuthorizedNavigation } from './adaptive-layout.js'

// RandApp primary navigation contract.
// Home and Menu remain stable anchors; the two operational slots are selected
// from authorized destinations and ranked by user interests.

export const PRIMARY_OPERATIONAL_NAV = Object.freeze([
  Object.freeze({ id: 'issues', key: 'issues', icon: 'issues', label: 'Segnalazioni' }),
  Object.freeze({ id: 'interventions', key: 'interventions', icon: 'wrench', label: 'Interventi' }),
  Object.freeze({ id: 'planning-work', key: 'planning_work', icon: 'calendar', label: 'Planning' }),
  Object.freeze({ id: 'inventory', key: 'inventory', icon: 'package', label: 'Magazzino' }),
  Object.freeze({ id: 'supplies', key: 'supplies', icon: 'package', label: 'Rifornimenti' }),
  Object.freeze({ id: 'urgent', key: 'urgent', icon: 'warning', label: 'Urgenti' }),
  Object.freeze({ id: 'housekeeping', key: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping' }),
])

export function buildPrimaryBottomNav({ placement, viewAllowed, interests = [] }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

  const authorized = PRIMARY_OPERATIONAL_NAV.filter((item) => placement(item.key) !== 'off' && viewAllowed(item.id))
  const ranked = rankAuthorizedNavigation(authorized, interests).slice(0, 2)

  return [
    ...ranked.map((item, index) => ({ ...item, slot: index + 1 })),
    { slot: 3, id: 'home', key: 'home', icon: 'home', label: 'Home' },
    { slot: 4, id: ranked[0]?.id ? 'my-work' : 'profile', key: ranked[0]?.id ? 'interventions' : 'profile', icon: ranked[0]?.id ? 'check' : 'user', label: ranked[0]?.id ? 'I miei lavori' : 'Profilo' },
    { slot: 5, id: 'menu', key: 'other', icon: 'menu', label: 'Altro' },
  ].filter((item) => item.id === 'menu' || (placement(item.key) !== 'off' && viewAllowed(item.id)))
}

export function isPrimaryBottomDestination(view) {
  return view === 'home' || view === 'my-work' || view === 'profile' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
