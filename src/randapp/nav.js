import {
  can, isAdminUser, canViewPlanned, canViewUrgent, canViewPlanningMenu,
  canViewTemperature, canViewHousekeeping, canViewTechnicianDirectory,
} from './helpers.js'

// Costruisce il menu completo dell'app, filtrato dai permessi reali del ruolo.
// Ogni voce corrisponde a una sezione realmente presente nel repository.
export function buildNav(user, hotel) {
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
    .map((group) => ({ ...group, items: group.items.filter((item) => item.show) }))
    .filter((group) => group.items.length)
}

// Mappa una voce di menu su come deve essere gestita (view interna o tab impostazioni).
export const NAV_TARGET = {
  'new-issue': { view: 'issues', create: true },
  'admin-users': { settings: 'users' },
  'admin-navigation': { settings: 'navigation' },
  'admin-sensors': { settings: 'sensors' },
}

// Guardie di permesso per bloccare l'accesso diretto a sezioni non consentite.
export const VIEW_GUARDS = {
  interventions: canViewPlanned,
  urgent: canViewUrgent,
  'planning-work': canViewPlanningMenu,
  'planning-sale': (u, hotel) => hotel?.id === 'hotelgio' && canViewPlanningMenu(u),
  housekeeping: canViewHousekeeping,
  temperature: canViewTemperature,
  technicians: canViewTechnicianDirectory,
  'feedback-received': isAdminUser,
}
