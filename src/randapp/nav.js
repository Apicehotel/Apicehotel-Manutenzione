import {
  can, isAdminUser, canViewPlanned, canViewUrgent, canViewPlanningMenu,
  canViewTemperature, canViewHousekeeping, canViewTechnicianDirectory,
} from './helpers.js'
import { canSendReminder } from '../reminders-data.js'
import { ITEM_TO_NAV_KEY, placementFor } from './role-navigation.js'

const placementAllows = (config, user, itemId, wanted = null) => {
  const key = ITEM_TO_NAV_KEY[itemId]
  if (!key) return true
  const placement = placementFor(config, user?.role, key)
  return wanted ? placement === wanted : placement !== 'off'
}

export function buildNav(user, hotel, navigationConfig = null, placement = null) {
  if (!user) return []
  const groups = [
    {
      id: 'principale', label: 'Principale', items: [
        { id: 'home', icon: 'home', label: 'Home', show: true },
        { id: 'issues', icon: 'issues', label: 'Segnalazioni', show: true },
        { id: 'new-issue', icon: 'plus', label: 'Nuova segnalazione', show: can(user, 'create') },
      ],
    },
    {
      id: 'operativita', label: 'Operatività', items: [
        { id: 'interventions', icon: 'wrench', label: 'Interventi', show: canViewPlanned(user) },
        { id: 'urgent', icon: 'warning', label: 'Avvisi urgenti', show: canViewUrgent(user) },
        { id: 'reminders', icon: 'bell', label: 'Promemoria', show: canSendReminder(user) },
        { id: 'planning-work', icon: 'calendar', label: 'Planning', show: canViewPlanningMenu(user) },
        { id: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping', show: canViewHousekeeping(user) },
        { id: 'temperature', icon: 'thermometer', label: 'Temperature', show: canViewTemperature(user) },
        { id: 'technicians', icon: 'phone', label: 'Rubrica tecnici', show: canViewTechnicianDirectory(user) },
        { id: 'feedback-received', icon: 'message', label: 'Feedback ricevuti', show: isAdminUser(user) },
      ],
    },
    {
      id: 'account', label: 'Account', items: [
        { id: 'profile', icon: 'user', label: 'Il mio profilo', show: true },
        { id: 'manual', icon: 'book', label: 'Manuale', show: true },
        { id: 'feedback', icon: 'message', label: 'Invia feedback', show: true },
      ],
    },
    {
      id: 'admin', label: 'Amministrazione', items: [
        { id: 'admin-users', icon: 'users', label: 'Utenti', show: isAdminUser(user) },
        { id: 'admin-navigation', icon: 'sliders', label: 'Ruoli e permessi', show: isAdminUser(user) },
        { id: 'admin-sensors', icon: 'sensor', label: 'Sensori', show: isAdminUser(user) },
      ],
    },
  ]
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.show && placementAllows(navigationConfig, user, item.id, placement)),
    }))
    .filter((group) => group.items.length)
}

export const NAV_TARGET = {
  'new-issue': { view: 'issues', create: true },
  'admin-users': { settings: 'users' },
  'admin-navigation': { settings: 'navigation' },
  'admin-sensors': { settings: 'sensors' },
}

export const VIEW_GUARDS = {
  interventions: canViewPlanned,
  urgent: canViewUrgent,
  reminders: canSendReminder,
  'planning-work': canViewPlanningMenu,
  'planning-sale': (u, hotel) => hotel?.id === 'hotelgio' && canViewPlanningMenu(u),
  housekeeping: canViewHousekeeping,
  temperature: canViewTemperature,
  technicians: canViewTechnicianDirectory,
  'feedback-received': isAdminUser,
}
