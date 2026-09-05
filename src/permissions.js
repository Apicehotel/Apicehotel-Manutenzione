import { supabase } from './supabase.js'

export const PERMISSION_ACTIONS = ['view','create','edit','assign','take_charge','complete','delete','manage']
export const PERMISSION_MODULES = ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians','users','role_permissions','app_settings','sensors','usage','diagnostics','inventory','supplies','desktop_download']
const CACHE_KEY='randapp-role-permissions-v1'
const allow=(...actions)=>new Set(actions)
const fallback={
  admin:Object.fromEntries(PERMISSION_MODULES.map(m=>[m,allow(...PERMISSION_ACTIONS)])),
  RandAI:Object.fromEntries(PERMISSION_MODULES.map(m=>[m,allow(...PERMISSION_ACTIONS)])),
  Supremo:Object.fromEntries(PERMISSION_MODULES.map(m=>[m,new Set()])), Direzione:{}, 'Direttore Centro Congressi':{}, 'Portiere Notturno':{}, manutentore:{}, 'Tecnico esterno':{}, Governante:{}, 'Capo Governante':{}, Reception:{}, 'Isola dei Golosi':{}, 'Ristorante Wine/Jazz':{}, 'Colazione Jazz':{},
}
fallback.RandAI.desktop_download=new Set()
for(const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians','inventory'])fallback.Supremo[m]=allow('view','create')
for(const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians','inventory'])fallback.Direzione[m]=allow('view','create','edit','assign','take_charge','complete')
for(const m of ['home','issues','interventions','planning_work','planning_sale','urgent','reminders','notifications','temperature','technicians','inventory'])fallback['Direttore Centro Congressi'][m]=allow('view','create','edit','assign','take_charge','complete')
fallback.Direzione.issues=allow('view','create','edit','assign','take_charge','complete','delete')
fallback['Direttore Centro Congressi'].issues=allow('view','create','edit','assign','take_charge','complete','delete')
fallback['Direttore Centro Congressi'].planning_sale=allow(...PERMISSION_ACTIONS)
for(const m of ['home','issues','interventions','planning_work','urgent','notifications','housekeeping'])fallback['Portiere Notturno'][m]=allow('view')
fallback['Portiere Notturno'].issues=allow('view','create','assign','take_charge','complete');fallback['Portiere Notturno'].interventions=allow('view','assign','take_charge','complete')
for(const m of ['home','issues','interventions','planning_work','planning_sale','urgent','notifications','temperature','technicians','inventory'])fallback.manutentore[m]=allow('view')
fallback.manutentore.issues=allow('view','create','edit','take_charge','complete');fallback.manutentore.interventions=allow('view','create','edit','take_charge','complete');fallback.manutentore.planning_work=allow('view','create','edit','take_charge','complete');fallback.manutentore.planning_sale=allow('view','take_charge','complete');fallback.manutentore.supplies=allow('view','complete')
for(const m of ['issues','interventions','planning_work','notifications'])fallback['Tecnico esterno'][m]=allow('view')
fallback['Tecnico esterno'].issues=allow('view','take_charge','complete');fallback['Tecnico esterno'].interventions=allow('view','take_charge','complete')
for(const r of ['Governante','Capo Governante']){fallback[r].home=allow('view');fallback[r].issues=allow('view','create');fallback[r].housekeeping=allow('view','edit','complete');fallback[r].notifications=allow('view');fallback[r].supplies=allow('view','create')}
for(const m of ['home','issues','interventions','planning_work','planning_sale','housekeeping','urgent','reminders','notifications','temperature','technicians'])fallback.Reception[m]=allow('view')
fallback.Reception.issues=allow('view','create','assign','take_charge','complete');fallback.Reception.interventions=allow('view','assign','take_charge','complete');fallback.Reception.housekeeping=allow('view','edit','complete');fallback.Reception.urgent=allow('view','create');fallback.Reception.reminders=allow('view','create','edit','delete','manage')
for(const r of ['Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz']){fallback[r].home=allow('view');fallback[r].issues=allow('view','create');fallback[r].notifications=allow('view')}
fallback['Colazione Jazz'].temperature=allow('view')
for(const r of ['Direzione','Direttore Centro Congressi'])fallback[r].reminders=allow(...PERMISSION_ACTIONS)
for(const r of ['Direzione','Direttore Centro Congressi','Reception'])fallback[r].desktop_download=allow('view')

let live={}
function loadLocal(){try{const raw=localStorage.getItem(CACHE_KEY);const rows=raw?JSON.parse(raw):[];if(Array.isArray(rows))applyRows(rows,false)}catch{}}
function applyRows(rows,persist=true){const next={};for(const row of rows||[]){if(!next[row.role])next[row.role]={};if(!next[row.role][row.module])next[row.role][row.module]=new Set();if(row.allowed)next[row.role][row.module].add(row.action)}live=next;if(persist){try{localStorage.setItem(CACHE_KEY,JSON.stringify(rows||[]))}catch{}}}
if(typeof window!=='undefined')loadLocal()

export function canRole(role,module,action='view'){
  if(role==='Supremo')return ['view','create'].includes(action)&&!['users','role_permissions','app_settings','sensors','usage','diagnostics'].includes(module)
  if(live?.[role]?.[module])return live[role][module].has(action)
  return Boolean(fallback?.[role]?.[module]?.has(action))
}
export function canUser(user,module,action='view'){return canRole(user?.role,module,action)}

export async function fetchRolePermissionRows(){
  if(!supabase)return[]
  const{data,error}=await supabase.from('role_permissions').select('role,module,action,allowed').order('role').order('module').order('action')
  if(error)throw error
  applyRows(data||[])
  return data||[]
}

export async function saveRolePermission(role,module,action,allowed){
  if(!supabase)throw new Error('Supabase non disponibile')
  if(role==='Supremo')throw new Error('Supremo ha una regola fissa: visualizza e inserisce; può correggere soltanto le manutenzioni create da lui')
  const{error}=await supabase.from('role_permissions').upsert({role,module,action,allowed,updated_at:new Date().toISOString()},{onConflict:'role,module,action'})
  if(error)throw error
  if(!live[role])live[role]={};if(!live[role][module])live[role][module]=new Set();if(allowed)live[role][module].add(action);else live[role][module].delete(action)
}

export function permissionLabels(){return{view:'Vedi',create:'Crea',edit:'Modifica',assign:'Assegna',take_charge:'Prendi in carico',complete:'Completa',delete:'Elimina',manage:'Gestisci'}}

if(supabase&&typeof window!=='undefined'){
  fetchRolePermissionRows().catch(()=>{})
  supabase.channel('role-permissions-live').on('postgres_changes',{event:'*',schema:'public',table:'role_permissions'},()=>{
    fetchRolePermissionRows().then(()=>window.dispatchEvent(new Event('randapp-permissions-changed'))).catch(()=>{})
  }).subscribe()
}
