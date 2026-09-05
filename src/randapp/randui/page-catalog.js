import { resolveRandUiPage } from './page-schema.js'

const page = (schema) => Object.freeze(resolveRandUiPage(schema))

export const RANDUI_PAGE_CATALOG = Object.freeze({
  home: page({ id:'home', domain:'operations', pageType:'dashboard', mobilePriority:true, capabilities:['kpi','next-actions','randai-suggestion'] }),
  issues: page({ id:'issues', domain:'maintenance', pageType:'list-detail', mobilePriority:true, permissions:['issues.read'], capabilities:['filters','create','detail','photo'] }),
  chat: page({ id:'chat', domain:'communications', pageType:'master-detail', mobilePriority:true, capabilities:['groups','messages','media'] }),
  housekeeping: page({ id:'housekeeping', domain:'housekeeping', pageType:'operational', mobilePriority:true, capabilities:['floor-context','room-list','report-action'] }),
  supplies: page({ id:'supplies', domain:'supplies', pageType:'operational', mobilePriority:true, capabilities:['area-floor-context','request-list','delivery-state'] }),
  interventions: page({ id:'interventions', domain:'maintenance', pageType:'list-detail', capabilities:['filters','detail','resolution'] }),
  inventory: page({ id:'inventory', domain:'warehouse', pageType:'management', capabilities:['catalog','stock','movements','audit'] }),
  'planning-work': page({ id:'planning-work', domain:'planning', pageType:'planning', capabilities:['timeline','create','detail'] }),
  'planning-sale': page({ id:'planning-sale', domain:'planning', pageType:'planning', capabilities:['timeline','create','detail'] }),
  urgent: page({ id:'urgent', domain:'communications', pageType:'list', mobilePriority:true, capabilities:['alerts','acknowledge','create'] }),
  reminders: page({ id:'reminders', domain:'planning', pageType:'list', capabilities:['schedule','status'] }),
  temperature: page({ id:'temperature', domain:'sensors', pageType:'monitor', capabilities:['status','history'] }),
  plants: page({ id:'plants', domain:'sensors', pageType:'monitor', capabilities:['status','history'] }),
  technicians: page({ id:'technicians', domain:'maintenance', pageType:'management', capabilities:['directory','create','availability'] }),
  profile: page({ id:'profile', domain:'account', pageType:'form', capabilities:['preferences','identity'] }),
  manual: page({ id:'manual', domain:'guides', pageType:'search-archive', capabilities:['search','content'] }),
  feedback: page({ id:'feedback', domain:'account', pageType:'form', capabilities:['submit'] }),
  settings: page({ id:'settings', domain:'administration', pageType:'settings', permissions:['admin'], capabilities:['users','roles','sensors','usage','diagnostics'] }),
  randai: page({ id:'randai', domain:'intelligence', pageType:'monitor', capabilities:['assistant','health','controls','guides'] }),
})

export function randUiPageFor(id) {
  return RANDUI_PAGE_CATALOG[id] || null
}

export function listRandUiPages() {
  return Object.values(RANDUI_PAGE_CATALOG)
}
