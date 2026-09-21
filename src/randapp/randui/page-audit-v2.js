import { RANDUI_PAGE_CATALOG } from './page-catalog.js'

export const RANDUI_AUDIT_STATUS = Object.freeze({
  KEEP: 'keep',
  UNIFY: 'unify',
  REBUILD: 'rebuild',
})

const audit = (status, priority, notes) => Object.freeze({ status, priority, notes:Object.freeze(notes) })

export const RANDUI_PAGE_AUDIT_V2 = Object.freeze({
  home: audit('unify','medium',['dashboard utile ma da portare nella stessa gabbia e ritmo delle pagine operative']),
  operations: audit('unify','medium',['hub anteprima Segnalazioni/Interventi stile Planning','niente scorciatoie Planning','densità mobile condivisa con Task']),
  issues: audit('unify','medium',['preservare workflow e filtri','uniformare header, spazi e azioni']),
  chat: audit('unify','medium',['preservare master/detail','uniformare chrome e densità']),
  housekeeping: audit('unify','medium',['motore locale/cache preservato','shell rs-ops-surface e contesto piano allineati']),
  supplies: audit('unify','medium',['cache e boundary online-write preservati','standalone usa PageTitle + rs-ops-surface']),
  interventions: audit('unify','medium',['lista densa allineata a Task e Operatività']),
  inventory: audit('unify','medium',['PageTitle + rs-ops-surface','scorte basse emergono prima nella lista']),
  'my-work': audit('unify','medium',['hub Task: Avvisi + Promemoria; lista I miei lavori sotto','niente scorciatoie Planning']),
  'planning-work': audit('unify','medium',['conteggi planning affiancati su mobile','rimuovere spazio improduttivo e mantenere CTA contestuale']),
  'planning-sale': audit('unify','medium',['preservare planning sale','CTA deve restare Nuova attività sala']),
  urgent: audit('unify','medium',['stato prima del contenuto','aperte/in carico ordinate sopra le chiuse']),
  reminders: audit('unify','medium',['allineare header, lista e stati']),
  temperature: audit('keep','low',['sezioni alert/offline/ok','stato prima del nome','cache last-known + ListFetchNotice']),
  plants: audit('keep','low',['struttura card e raggruppamenti già valida','riferimento condiviso con Sensori']),
  technicians: audit('unify','medium',['preservare directory e permessi','uniformare gestione e azioni']),
  profile: audit('unify','low',['reading width e form canonico']),
  pin: audit('unify','low',['form breve, mantenere reading width']),
  manual: audit('unify','medium',['ricerca/archivio deve usare stessa gerarchia RandUI']),
  feedback: audit('unify','low',['form semplice, standardizzare feedback state']),
  'feedback-received': audit('unify','medium',['lista amministrativa, uniformare filtri/stati']),
  'desktop-download': audit('keep','low',['system-state centrato è coerente con il template']),
  settings: audit('unify','medium',['conservare struttura amministrativa','evitare secondo chrome e uniformare sezioni']),
  randai: audit('unify','medium',['pannello overlay resta configurabile','chrome allineato a shell senza diventare app parallela']),
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
