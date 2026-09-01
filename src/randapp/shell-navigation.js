import { installSwipeMenuGesture } from './swipe-navigation.js'

// RandApp primary navigation contract.
// Five visible mobile slots are structural: permissions can disable a destination,
// but cannot move Home away from the centre or turn the create action into navigation.
// Menu remains mounted as a hidden gesture target so swipe-left can open the existing drawer.

export const PRIMARY_BOTTOM_NAV = Object.freeze([
  Object.freeze({ slot: 1, id: 'issues', key: 'issues', icon: 'issues', label: 'Segnalazioni' }),
  Object.freeze({ slot: 2, id: 'interventions', key: 'interventions', icon: 'wrench', label: 'Interventi' }),
  Object.freeze({ slot: 3, id: 'home', key: 'home', icon: 'home', label: 'Home' }),
  Object.freeze({ slot: 4, id: 'planning-work', key: 'planning_work', icon: 'calendar', label: 'Planning' }),
  Object.freeze({ slot: 5, id: 'inventory', key: 'inventory', icon: 'package', label: 'Magazzino' }),
  Object.freeze({ slot: 6, id: 'menu', key: 'other', icon: 'menu', label: 'Menu', gestureOnly: true }),
])

export function buildPrimaryBottomNav({ placement, viewAllowed }) {
  if (typeof placement !== 'function' || typeof viewAllowed !== 'function') return []

  return PRIMARY_BOTTOM_NAV.filter((item) => {
    if (placement(item.key) === 'off') return false
    if (item.id === 'menu') return true
    return viewAllowed(item.id)
  })
}

export function isPrimaryBottomDestination(view) {
  return PRIMARY_BOTTOM_NAV.some((item) => item.id === view && item.id !== 'menu')
}

if (typeof window !== 'undefined') installSwipeMenuGesture()
