import { RANDUI_PAGE_CATALOG, RANDUI_MIGRATED_PAGE_IDS } from './page-catalog.js'
import { resolveRandUiTemplate } from './template-registry.js'

export const RANDUI_PAGE_AUDIT_VERSION = 'page-audit-v2'

export const RANDUI_AUDIT_DECISION = Object.freeze({
  KEEP: 'KEEP',
  ALIGN: 'ALIGN',
  REWORK: 'REWORK',
})

const { KEEP, ALIGN, REWORK } = RANDUI_AUDIT_DECISION
const define = (decision, priority, focus) => Object.freeze({ decision, priority, focus })

const AUDIT_INPUT = Object.freeze({
  home: define(ALIGN, 'P1', 'Gerarchia dashboard e ritmo verticale'),
  operations: define(ALIGN, 'P1', 'Densita hub e priorita delle destinazioni'),
  issues: define(ALIGN, 'P1', 'Lista/dettaglio e azioni mobile'),
  chat: define(ALIGN, 'P1', 'Master/detail e leggibilita mobile'),
  housekeeping: define(ALIGN, 'P1', 'Contesto piano e gerarchia azioni'),
  supplies: define(ALIGN, 'P1', 'Contesto area/piano e stati richiesta'),
  interventions: define(ALIGN, 'P1', 'Filtri, dettaglio e risoluzione'),
  inventory: define(ALIGN, 'P1', 'Densita gestionale e movimenti stock'),
  'my-work': define(ALIGN, 'P1', 'Task assegnati e azione primaria'),
  'planning-work': define(ALIGN, 'P1', 'Agenda mobile, timeline e creazione'),
  'planning-sale': define(ALIGN, 'P1', 'Agenda mobile, timeline e creazione sale'),
  urgent: define(ALIGN, 'P1', 'Priorita alert e acknowledge'),
  reminders: define(ALIGN, 'P1', 'Scansione lista e stato temporale'),
  temperature: define(REWORK, 'P0', 'Sensori: gerarchia, stato e storico'),
  plants: define(REWORK, 'P0', 'Impianti: stato, allarmi e storico'),
  technicians: define(ALIGN, 'P1', 'Rubrica, disponibilita e creazione'),
  profile: define(KEEP, 'P2', 'Form semplice gia adatto al template reading'),
  pin: define(KEEP, 'P2', 'Form credenziale semplice e focalizzato'),
  manual: define(ALIGN, 'P1', 'Ricerca, archivio e dettaglio guida'),
  feedback: define(KEEP, 'P2', 'Form singolo a basso carico cognitivo'),
  'feedback-received': define(ALIGN, 'P1', 'Lista amministrativa e revisione'),
  'desktop-download': define(KEEP, 'P2', 'System state centrato e azione singola'),
  settings: define(ALIGN, 'P1', 'Gerarchia amministrativa senza secondo menu'),
  randai: define(ALIGN, 'P1', 'Dashboard intelligence, controlli e guide'),
})

const catalogIds = [...RANDUI_MIGRATED_PAGE_IDS].sort()
const auditIds = Object.keys(AUDIT_INPUT).sort()
if (catalogIds.length !== 24 || catalogIds.join('|') !== auditIds.join('|')) {
  throw new Error('RandUI page audit must cover the canonical 24/24 page catalog')
}

export const RANDUI_PAGE_AUDIT = Object.freeze(Object.fromEntries(
  RANDUI_MIGRATED_PAGE_IDS.map((id) => {
    const page = RANDUI_PAGE_CATALOG[id]
    const audit = AUDIT_INPUT[id]
    const template = resolveRandUiTemplate(page.pageType)
    if (!template) throw new Error(`RandUI page audit references unknown template: ${page.pageType}`)
    return [id, Object.freeze({
      id,
      domain: page.domain,
      pageType: page.pageType,
      mobilePriority: page.mobilePriority,
      decision: audit.decision,
      priority: audit.priority,
      focus: audit.focus,
    })]
  }),
))

export function listRandUiPageAudit() {
  return RANDUI_MIGRATED_PAGE_IDS.map((id) => RANDUI_PAGE_AUDIT[id])
}

export function summarizeRandUiPageAudit() {
  return listRandUiPageAudit().reduce((summary, row) => {
    summary.total += 1
    summary[row.decision] += 1
    summary[row.priority] += 1
    return summary
  }, { total: 0, KEEP: 0, ALIGN: 0, REWORK: 0, P0: 0, P1: 0, P2: 0 })
}
