import { RANDUI_TEMPLATE_IDS } from './design-contract.js'

const CORE = Object.freeze(['TemplateFrame', 'Icon', 'Button', 'IconButton', 'Card', 'Badge', 'SystemState'])
const FORMS = Object.freeze([...CORE, 'Field', 'TextInput', 'Segmented', 'Sheet', 'Modal', 'ConfirmDialog'])
const SETTINGS = Object.freeze([...FORMS, 'UiSizeControl', 'ThemeControl'])

const define = ({ slots, components = CORE, responsive, density = 'normal' }) => Object.freeze({
  slots: Object.freeze([...slots]),
  allowedComponents: Object.freeze([...new Set(components)]),
  responsive: Object.freeze({ ...responsive }),
  defaultDensity: density,
})

export const RANDUI_TEMPLATE_REGISTRY = Object.freeze({
  dashboard: define({ slots:['header','kpis','primary','secondary','actions'], responsive:{mobile:'stack',tablet:'grid-2',desktop:'grid-12'} }),
  list: define({ slots:['header','toolbar','content','actions'], responsive:{mobile:'stack',tablet:'stack',desktop:'content-wide'} }),
  'list-detail': define({ slots:['header','toolbar','list','detail','actions'], responsive:{mobile:'route-or-sheet',tablet:'split-5-7',desktop:'split-4-8'} }),
  'master-detail': define({ slots:['header','master','detail','aside'], responsive:{mobile:'route-or-sheet',tablet:'split-4-8',desktop:'split-3-6-3'} }),
  operational: define({ slots:['header','context','summary','work','actions'], responsive:{mobile:'stack-priority',tablet:'grid-touch',desktop:'grid-12'}, density:'small' }),
  planning: define({ slots:['header','toolbar','timeline','detail','actions'], responsive:{mobile:'agenda',tablet:'timeline-touch',desktop:'timeline-wide'} }),
  form: define({ slots:['header','form','actions','feedback'], components:FORMS, responsive:{mobile:'stack',tablet:'reading-width',desktop:'reading-width'} }),
  wizard: define({ slots:['header','progress','form','actions','feedback'], components:FORMS, responsive:{mobile:'stack',tablet:'reading-width',desktop:'reading-width'} }),
  settings: define({ slots:['header','toolbar','content','actions'], components:SETTINGS, responsive:{mobile:'stack',tablet:'stack',desktop:'content-wide'} }),
  management: define({ slots:['header','toolbar','summary','content','detail','actions'], components:SETTINGS, responsive:{mobile:'stack',tablet:'grid-2',desktop:'grid-12'} }),
  monitor: define({ slots:['header','status','kpis','primary','activity','actions'], responsive:{mobile:'stack',tablet:'grid-2',desktop:'grid-12'} }),
  'system-state': define({ slots:['state','actions'], components:['TemplateFrame','Button','Icon','SystemState'], responsive:{mobile:'center',tablet:'center',desktop:'center'} }),
  auth: define({ slots:['brand','form','support','feedback'], components:FORMS, responsive:{mobile:'center',tablet:'center',desktop:'center'} }),
  'search-archive': define({ slots:['header','search','filters','results','detail','actions'], components:FORMS, responsive:{mobile:'stack',tablet:'stack',desktop:'split-4-8'} }),
})

if (Object.keys(RANDUI_TEMPLATE_REGISTRY).length !== RANDUI_TEMPLATE_IDS.length || RANDUI_TEMPLATE_IDS.some((id) => !RANDUI_TEMPLATE_REGISTRY[id])) {
  throw new Error('RandUI template registry is out of sync with the design contract')
}

export function resolveRandUiTemplate(id) {
  return RANDUI_TEMPLATE_REGISTRY[id] || null
}

export function listRandUiTemplates() {
  return RANDUI_TEMPLATE_IDS.map((id) => Object.freeze({ id, ...RANDUI_TEMPLATE_REGISTRY[id] }))
}
