import { canUser } from '../permissions.js'
import { ITEM_TO_NAV_KEY, placementFor } from './role-navigation.js'

const placementAllows = (config, user, itemId, wanted = null) => {
  const key = ITEM_TO_NAV_KEY[itemId]
  if (!key) return true
  const placement = placementFor(config, user?.role, key)
  return wanted ? placement === wanted : placement !== 'off'
}

const view = (module) => (user) => canUser(user, module, 'view')
const create = (module) => (user) => canUser(user, module, 'create')

export function buildNav(user, hotel, navigationConfig = null, placement = null) {
  if (!user) return []
  const groups = [
    {
      id: 'principale', label: 'Principale', items: [
        { id: 'home', icon: 'home', label: 'Home', show: canUser(user, 'home', 'view') },
        { id: 'issues', icon: 'issues', label: 'Segnalazioni', show: canUser(user, 'issues', 'view') },
        { id: 'new-issue', icon: 'plus', label: 'Nuova segnalazione', show: canUser(user, 'issues', 'create') },
        { id: 'my-work', icon: 'check', label: 'I miei lavori', show: canUser(user, 'interventions', 'view') },
      ],
    },
    {
      id: 'operativita', label: 'Operatività', items: [
        { id: 'interventions', icon: 'wrench', label: 'Interventi', show: canUser(user, 'interventions', 'view') },
        { id: 'urgent', icon: 'warning', label: 'Avvisi urgenti', show: canUser(user, 'urgent', 'view') },
        { id: 'reminders', icon: 'bell', label: 'Promemoria', show: canUser(user, 'reminders', 'view') },
        { id: 'planning-work', icon: 'calendar', label: 'Planning', show: canUser(user, 'planning_work', 'view') || canUser(user, 'planning_sale', 'view') },
        { id: 'housekeeping', icon: 'housekeeping', label: 'Housekeeping', show: canUser(user, 'housekeeping', 'view') },
        { id: 'temperature', icon: 'thermometer', label: 'Sensori', show: canUser(user, 'temperature', 'view') },
        { id: 'plants', icon: 'wrench', label: 'Impianti', show: canUser(user, 'temperature', 'view') },
        { id: 'technicians', icon: 'phone', label: 'Rubrica tecnici', show: canUser(user, 'technicians', 'view') },
        { id: 'feedback-received', icon: 'message', label: 'Feedback ricevuti', show: canUser(user, 'app_settings', 'manage') },
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
        { id: 'admin-users', icon: 'users', label: 'Utenti', show: canUser(user, 'users', 'manage') },
        { id: 'admin-navigation', icon: 'sliders', label: 'Ruoli e permessi', show: canUser(user, 'role_permissions', 'manage') },
        { id: 'admin-sensors', icon: 'sensor', label: 'Configura sensori', show: canUser(user, 'sensors', 'manage') },
        { id: 'admin-usage', icon: 'activity', label: 'Consumi', show: canUser(user, 'usage', 'view') },
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
  'plants': { view: 'plants' },
  'admin-users': { settings: 'users' },
  'admin-navigation': { settings: 'navigation' },
  'admin-sensors': { settings: 'sensors' },
  'admin-usage': { settings: 'usage' },
}

export const VIEW_GUARDS = {
  home: view('home'),
  issues: view('issues'),
  interventions: view('interventions'),
  urgent: view('urgent'),
  reminders: view('reminders'),
  'planning-work': (u) => canUser(u, 'planning_work', 'view') || canUser(u, 'planning_sale', 'view'),
  'planning-sale': (u, hotel) => hotel?.id === 'hotelgio' && canUser(u, 'planning_sale', 'view'),
  housekeeping: view('housekeeping'),
  temperature: view('temperature'),
  plants: view('temperature'),
  technicians: view('technicians'),
  'feedback-received': (u) => canUser(u, 'app_settings', 'manage'),
}

export const CREATE_GUARDS = {
  issue: create('issues'),
  urgent: create('urgent'),
  intervention: create('interventions'),
  'planning-work': create('planning_work'),
  'planning-sale': create('planning_sale'),
  reminder: create('reminders'),
}
