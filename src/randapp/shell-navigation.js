import { interestsForNavItem, rankAuthorizedNavigation } from './adaptive-layout.js'

// RandApp primary navigation contract.
// Home and Altro remain stable anchors. Operational slots are authorized first,
// then prioritized from the existing per-role placement configuration: items
// explicitly placed on bottom navigation act as declared operational interests.

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
  const configuredInterestTags = authorized
    .filter((item) => placement(item.key) === 'bottom')
    .flatMap((item) => interestsForNavItem(item.id))
  const effectiveInterests = interests.length ? interests : configuredInterestTags
  const ranked = rankAuthorizedNavigation(authorized, effectiveInterests).slice(0, 3)

  return [
    ...ranked.slice(0, 2).map((item, index) => ({ ...item, slot: index + 1 })),
    { slot: 3, id: 'home', key: 'home', icon: 'home', label: 'Home' },
    ...(ranked[2] ? [{ ...ranked[2], slot: 4 }] : []),
    { slot: 5, id: 'menu', key: 'other', icon: 'menu', label: 'Altro' },
  ].filter((item) => item.id === 'menu' || (placement(item.key) !== 'off' && viewAllowed(item.id)))
}

export function isPrimaryBottomDestination(view) {
  return view === 'home' || PRIMARY_OPERATIONAL_NAV.some((item) => item.id === view)
}
