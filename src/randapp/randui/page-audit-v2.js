import { RANDUI_PAGE_CATALOG } from './page-catalog.js'

export const RANDUI_AUDIT_STATUS = Object.freeze({
  KEEP: 'keep',
  UNIFY: 'unify',
  REBUILD: 'rebuild',
})

const audit = (status, priority, notes) => Object.freeze({ status, priority, notes:Object.freeze(notes) })

export const RANDUI_PAGE_AUDIT_V2 = Object.freeze({
  home: audit('unify','medium',['dashboard utile ma da portare nella stessa gabbia e ritmo delle pagine operative']),
  operations: audit('unify','high',['spazio verticale eccessivo prima del contenuto utile','candidato allo slot operativo Adesso']),
  issues: audit('unify','medium',['preservare workflow e filtri','uniformare header, spazi e azioni']),
  chat: audit('unify','medium',['preservare master/detail','uniformare chrome e densità']),
  housekeeping: audit('unify','high',['preservare motore locale/cache','uniformare contesto piano e gerarchia']),
  supplies: audit('unify','high',['preservare cache e boundary online-write','uniformare contesto area/piano e richieste']),
  interventions: audit('unify','high',['CTA corretta dal Punto 1','uniformare lista/dettaglio e primo contenuto utile']),
  inventory: audit('unify','high',['struttura a funzioni riutilizzabile','spazio verticale e bottom-nav da non duplicare']),
  'my-work': audit('unify','high',['Task è destinazione primaria mobile','ottimizzare densità operativa']),
  'planning-work': audit('unify','high',['preservare calendario e timeline','rimuovere spazio improduttivo e mantenere CTA contestuale']),
  'planning-sale': audit('unify','high',['preservare planning sale','CTA deve restare Nuova attività sala']),
  urgent: audit('unify','high',['priorità e stato devono emergere prima del contenuto ordinario']),
  reminders: audit('unify','medium',['allineare header, lista e stati']),
  temperature: audit('rebuild','critical',['presentazione legacy confermata su iPhone','nome/stato/aggiornamento/valore devono avere gerarchia','offline e alert devono emergere prima']),
  plants: audit('keep','low',['struttura card e raggruppamenti già valida','usare come riferimento per Sensori']),
  technicians: audit('unify','medium',['preservare directory e permessi','uniformare gestione e azioni']),
  profile: audit('unify','low',['reading width e form canonico']),
  pin: audit('unify','low',['form breve, mantenere reading width']),
  manual: audit('unify','medium',['ricerca/archivio deve usare stessa gerarchia RandUI']),
  feedback: audit('unify','low',['form semplice, standardizzare feedback state']),
  'feedback-received': audit('unify','medium',['lista amministrativa, uniformare filtri/stati']),
  'desktop-download': audit('keep','low',['system-state centrato è coerente con il template']),
  settings: audit('unify','medium',['conservare struttura amministrativa','evitare secondo chrome e uniformare sezioni']),
  randai: audit('unify','high',['pannello deve restare configurabile per permessi/funzioni/guide','uniformare gerarchia senza trasformarlo in app parallela']),
})

export function auditRandUiPageCoverage() {
  const catalogIds = Object.keys(RANDUI_PAGE_CATALOG).sort()
  const auditIds = Object.keys(RANDUI_PAGE_AUDIT_V2).sort()
  return Object.freeze({
    complete: JSON.stringify(catalogIds) === JSON.stringify(auditIds),
    catalogIds,
    auditIds,
    rebuild: auditIds.filter((id) => RANDUI_PAGE_AUDIT_V2[id].status === RANDUI_AUDIT_STATUS.REBUILD),
    keep: auditIds.filter((id) => RANDUI_PAGE_AUDIT_V2[id].status === RANDUI_AUDIT_STATUS.KEEP),
    unify: auditIds.filter((id) => RANDUI_PAGE_AUDIT_V2[id].status === RANDUI_AUDIT_STATUS.UNIFY),
  })
}
