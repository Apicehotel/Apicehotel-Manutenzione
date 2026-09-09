import { HOTELS } from '../../config.js'
import { permissionLabels } from '../../permissions.js'

// Share labels and destinations with the shell; only real menu entries are editable.
export { ROLE_NAV_KEY as NAV_KEY } from '../role-navigation.js'
import { ROLE_NAV_ITEMS } from '../role-navigation.js'
export const NAV_ITEMS = ROLE_NAV_ITEMS.filter(([key]) => key !== 'other' && key !== 'export')
export const PLACEMENTS = [['bottom', 'Barra e menu'], ['side', 'Solo menu'], ['off', 'Nascosto']]
export const ALL_HOTEL_IDS = HOTELS.map((h) => h.id)
export const ROLE_PRIORITY = ['admin','Supremo','Direzione','Direttore Centro Congressi','Portiere Notturno','manutentore','Capo Governante','Governante','Reception','Isola dei Golosi','Ristorante Wine/Jazz','Colazione Jazz','Tecnico esterno']
export const ACTION_LABELS = permissionLabels()
export const PERMISSION_GROUPS = [
  { id:'maintenance', label:'Segnalazioni e interventi', modules:[['issues','Segnalazioni'],['interventions','Interventi']] },
  { id:'planning', label:'Planning', modules:[['planning_work','Planning lavori'],['planning_sale','Planning Sale']] },
  { id:'operations', label:'Operatività hotel', modules:[['housekeeping','Housekeeping'],['temperature','Temperature'],['technicians','Rubrica tecnici']] },
  { id:'alerts', label:'Avvisi e notifiche', modules:[['urgent','Avvisi urgenti'],['reminders','Promemoria'],['notifications','Centro notifiche']] },
  { id:'system', label:'Amministrazione', modules:[['desktop_download','Download RandDesktop'],['users','Utenti'],['role_permissions','Ruoli e permessi'],['app_settings','Impostazioni app'],['sensors','Sensori'],['usage','Consumi'],['diagnostics','Diagnostica']] },
]
export const ACTIONS_BY_MODULE = {
  home:['view'], issues:['view','create','edit','assign','take_charge','complete','delete'], interventions:['view','create','edit','assign','take_charge','complete','delete'],
  planning_work:['view','create','edit','assign','take_charge','complete','delete'], planning_sale:['view','create','edit','take_charge','complete','delete','manage'],
  housekeeping:['view','create','edit','complete','manage'], urgent:['view','create','edit','complete','delete','manage'], reminders:['view','create','edit','delete','manage'],
  notifications:['view','edit','manage'], temperature:['view','edit','manage'], technicians:['view','create','edit','delete','manage'], desktop_download:['view'], users:['view','create','edit','delete','manage'],
  role_permissions:['view','edit','manage'], app_settings:['view','edit','manage'], sensors:['view','create','edit','delete','manage'], usage:['view','manage'], diagnostics:['view','manage'],
}
