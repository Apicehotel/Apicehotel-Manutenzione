import { supabase } from './supabase.js'

export const PERMISSION_ACTIONS = ['view','create','edit','assign','take_charge','complete','delete','manage']
export const PERMISSION_MODULES = ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians','users','role_permissions','app_settings']

const allow = (...actions) => new Set(actions)
const matrix = {
  admin: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, allow(...PERMISSION_ACTIONS)])),
  Supremo: Object.fromEntries(PERMISSION_MODULES.map((m) => [m, new Set()])),
  Direzione: {}, 'Direttore Centro Congressi': {}, 'Portiere Notturno': {}, manutentore: {}, 'Tecnico esterno': {}, Governante: {}, 'Capo Governante': {}, Reception: {}, 'Isola dei Golosi': {}, 'Ristorante Wine/Jazz': {}, 'Colazione Jazz': {},
}

for (const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians']) matrix.Supremo[m] = allow('view','create')
for (const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians']) matrix.Direzione[m] = allow('view','create','edit','assign','take_charge','complete')
for (const m of ['home','issues','interventions','planning_work','planning_sale','urgent','reminders','notifications','temperature','technicians']) matrix['Direttore Centro Congressi'][m] = allow('view','create','edit','assign','take_charge','complete')
matrix['Direttore Centro Congressi'].planning_sale = allow('view','create','edit','assign','take_charge','complete','delete','manage')
for (const m of ['home','issues','interventions','planning_work','urgent','notifications','housekeeping']) matrix['Portiere Notturno'][m] = allow('view')
matrix['Portiere Notturno'].issues = allow('view','create','assign','take_charge','complete'); matrix['Portiere Notturno'].interventions = allow('view','assign','take_charge','complete')
for (const m of ['home','issues','interventions','planning_work','planning_sale','urgent','notifications','temperature','technicians']) matrix.manutentore[m] = allow('view')
matrix.manutentore.issues = allow('view','create','edit','take_charge','complete'); matrix.manutentore.interventions = allow('view','create','edit','take_charge','complete'); matrix.manutentore.planning_work = allow('view','create','edit','take_charge','complete'); matrix.manutentore.planning_sale = allow('view','take_charge','complete')
for (const m of ['issues','interventions','planning_work','notifications']) matrix['Tecnico esterno'][m] = allow('view')
matrix['Tecnico esterno'].issues = allow('view','take_charge','complete'); matrix['Tecnico esterno'].interventions = allow('view','take_charge','complete')
for (const r of ['Governante','Capo Governante']) { matrix[r].home=allow('view'); matrix[r].issues=allow('view','create'); matrix[r].housekeeping=allow('view'); matrix[r].notifications=allow('view') }
matrix['Capo Governante'].housekeeping = allow('view','edit','complete')
for (const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians']) matrix.Reception[m] = allow('view')
matrix.Reception.issues = allow('view','create','assign','take_charge','complete'); matrix.Reception.interventions = allow('view','assign','take_charge','complete'); matrix.Reception.urgent=allow('view','create'); matrix.Reception.reminders=allow('view','create','edit','delete','manage')
for (const r of ['Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz']) { matrix[r].home=allow('view'); matrix[r].issues=allow('view','create'); matrix[r].notifications=allow('view') }
matrix['Colazione Jazz'].temperature=allow('view')
for (const r of ['Direzione','Direttore Centro Congressi']) matrix[r].reminders=allow('view','create','edit','delete','manage')

export function canRole(role, module, action='view') {
  return Boolean(matrix?.[role]?.[module]?.has(action))
}
export function canUser(user, module, action='view') { return canRole(user?.role, module, action) }

export async function fetchRolePermissionRows() {
  if (!supabase) return []
  const { data, error } = await supabase.from('role_permissions').select('role,module,action,allowed').order('role').order('module').order('action')
  if (error) throw error
  return data || []
}

export async function saveRolePermission(role, module, action, allowed) {
  if (!supabase) throw new Error('Supabase non disponibile')
  const { error } = await supabase.from('role_permissions').upsert({ role, module, action, allowed, updated_at: new Date().toISOString() }, { onConflict: 'role,module,action' })
  if (error) throw error
}

export function permissionLabels() {
  return {
    view:'Vedi', create:'Crea', edit:'Modifica', assign:'Assegna', take_charge:'Prendi in carico', complete:'Completa', delete:'Elimina', manage:'Gestisci',
  }
}
