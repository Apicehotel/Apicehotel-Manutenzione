import { supabase } from '../supabase.js'

export const ROLE_NAV_KEY = 'role_navigation_v1'

export const ROLE_NAV_ITEMS = [
  ['home', 'Home'],
  ['issues', 'Segnalazioni'],
  ['interventions', 'Interventi'],
  ['planning_work', 'Planning'],
  ['housekeeping', 'Housekeeping'],
  ['temperature', 'Sensori e impianti'],
  ['urgent', 'Avvisi urgenti'],
  ['reminders', 'Promemoria'],
  ['technicians', 'Rubrica tecnici'],
  ['structure', 'Cambia struttura'],
  ['profile', 'Il mio profilo'],
  ['manual', 'Manuale'],
  ['feedback', 'Feedback'],
  ['feedback_received', 'Feedback ricevuti'],
  ['export', 'Esporta dati'],
  ['cache', 'Pulisci cache'],
  ['other', 'Menu'],
]

export const VIEW_TO_NAV_KEY = {
  home: 'home',
  issues: 'issues',
  interventions: 'interventions',
  'planning-work': 'planning_work',
  'planning-sale': 'planning_work',
  housekeeping: 'housekeeping',
  temperature: 'temperature',
  urgent: 'urgent',
  reminders: 'reminders',
  technicians: 'technicians',
  profile: 'profile',
  manual: 'manual',
  feedback: 'feedback',
  'feedback-received': 'feedback_received',
}

export const ITEM_TO_NAV_KEY = {
  home: 'home',
  issues: 'issues',
  'new-issue': 'issues',
  interventions: 'interventions',
  urgent: 'urgent',
  reminders: 'reminders',
  'planning-work': 'planning_work',
  'planning-sale': 'planning_work',
  housekeeping: 'housekeeping',
  temperature: 'temperature',
  plants: 'temperature',
  technicians: 'technicians',
  profile: 'profile',
  manual: 'manual',
  feedback: 'feedback',
  'feedback-received': 'feedback_received',
}

const FALLBACK = {
  home: 'bottom',
  issues: 'bottom',
  interventions: 'side',
  planning_work: 'side',
  housekeeping: 'side',
  temperature: 'side',
  urgent: 'side',
  reminders: 'side',
  technicians: 'side',
  structure: 'side',
  profile: 'side',
  manual: 'side',
  feedback: 'side',
  feedback_received: 'off',
  export: 'off',
  cache: 'side',
  other: 'bottom',
}

export function parseRoleNavigation(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function placementFor(config, role, key) {
  const canonicalKey = key === 'planning_sale' ? 'planning_work' : key
  return config?.[role]?.[canonicalKey] || FALLBACK[canonicalKey] || 'off'
}

export function isNavVisible(config, role, key) {
  return placementFor(config, role, key) !== 'off'
}

export async function fetchRoleNavigation() {
  if (!supabase) return {}
  const { data, error } = await supabase.from('app_config').select('value').eq('key', ROLE_NAV_KEY).maybeSingle()
  if (error) throw error
  return parseRoleNavigation(data?.value)
}

export function subscribeRoleNavigation(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel(`role-navigation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config', filter: `key=eq.${ROLE_NAV_KEY}` }, (payload) => {
      onChange(parseRoleNavigation(payload?.new?.value))
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
