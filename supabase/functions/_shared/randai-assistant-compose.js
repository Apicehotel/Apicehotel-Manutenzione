/**
 * Compose a field-effective RandAI answer from multiple evidence sources.
 * Never invents procedures or thresholds: ranks only approved/verified/live data.
 */

const HVAC_NEXT = Object.freeze({
  'check-upstream-data': 'Verifica prima le temperature Wine a monte (online e aggiornate).',
  'circuit-off': 'Il circuito risulta SPENTO: riattivalo o conferma lo stato fisico prima di altri controlli.',
  'circuit-on-check-downstream': 'Circuito ATTIVO: prosegui a valle (camera/ramo) senza dichiarare le temperature “ok” se non ci sono soglie.',
  'check-circuit-state': 'Stato circuito non affidabile: controlla l’interruttore della zona.',
  'check-floor-temperature-data': 'Controlla il sensore C/F del piano Jazz (assente, offline o non recente).',
  'floor-temperature-available-switch-unmapped': 'Temperatura piano disponibile: verifica manualmente l’interruttore Jazz (non ancora mappato in RandAI).',
  'floor-circuit-off': 'Circuito piano Jazz SPENTO: verifica fisicamente l’interruttore.',
  'floor-circuit-on-check-downstream': 'Circuito piano Jazz ATTIVO: se il problema resta, scendi a valle verso camera/ramo.',
  'temperature-alert': 'Sensore in ALLERTA: tratta la temperatura come anomalia operativa e verifica il locale.',
  'insufficient-data': 'Dati HVAC insufficienti: specifica camera/piano e sezione (Wine/Jazz).',
})

const MISSING_CHECKS = Object.freeze([
  'Indica camera o zona e il sintomo (es. non raffresca / non scalda).',
  'Se possibile, specifica Wine o Jazz e il piano.',
  'Controlla se c’è già una procedura approvata o un caso in memoria per questa struttura.',
  'Annota temperature/interruttori visti sul campo prima di chiudere.',
])

export function hvacNextCheck(diagnostic) {
  if (!diagnostic) return null
  if (Array.isArray(diagnostic.temperatures) && diagnostic.temperatures.some((row) => row?.alert && row?.online)) {
    return HVAC_NEXT['temperature-alert']
  }
  return HVAC_NEXT[diagnostic.conclusion] || HVAC_NEXT['insufficient-data']
}

export function composeRandAIAnswer({
  intent = 'general',
  section = null,
  resolvedQuery = '',
  memory = [],
  sensors = [],
  hvacDiagnostic = null,
  procedure = null,
  equipment = [],
  history = [],
  documents = [],
  buildSuggestion,
} = {}) {
  const suggestions = []
  if (typeof buildSuggestion === 'function') {
    if (procedure) {
      suggestions.push(buildSuggestion({
        kind: 'procedure',
        id: procedure.id,
        title: procedure.title,
        summary: procedure.summary,
        trust: 'APPROVED',
        actionable: true,
        nextAction: Array.isArray(procedure.steps) ? procedure.steps[0] : 'Apri la procedura e verifica il primo passaggio.',
        provenance: { kind: 'maintenance_procedure', id: procedure.id, version: procedure.version },
        caution: procedure.caution,
      }))
    }
    for (const item of memory.slice(0, 3)) {
      suggestions.push(buildSuggestion({
        kind: 'experience',
        id: item.id,
        title: item.symptom || 'Caso precedente simile',
        summary: item.solution || item.cause,
        trust: 'VERIFIED',
        actionable: false,
        nextAction: 'Confronta il caso precedente con i dati attuali; non applicare automaticamente la soluzione.',
        provenance: { kind: 'memory', id: item.id },
      }))
    }
    for (const item of history.slice(0, 3)) {
      suggestions.push(buildSuggestion({
        kind: 'experience',
        id: item.id,
        title: `Storico ${item.kind}`,
        summary: item.text,
        trust: 'VERIFIED',
        actionable: false,
        nextAction: 'Confronta lo storico con il problema attuale.',
        provenance: { kind: 'history', id: item.id },
      }))
    }
  }

  const nextChecks = []
  const hvacCheck = hvacNextCheck(hvacDiagnostic)
  if (hvacCheck) nextChecks.push(hvacCheck)
  if (procedure?.steps?.[0]) nextChecks.push(`Procedura: ${procedure.steps[0]}`)
  else if (suggestions[0]?.nextAction) nextChecks.push(suggestions[0].nextAction)
  if (memory[0]?.solution) nextChecks.push('Confronta la memoria verificata con lo stato live prima di agire.')
  if (sensors.some((sensor) => !sensor.online || sensor.stale)) {
    nextChecks.push('Almeno un sensore live è offline o non recente: non basare la diagnosi solo su quel dato.')
  }

  const hasEvidence = Boolean(
    procedure
    || memory.length
    || documents.length
    || sensors.length
    || hvacDiagnostic
    || equipment.length
    || history.length,
  )

  let source = 'composed_evidence'
  if (intent === 'location' && equipment.length) source = 'equipment_location'
  else if (hvacDiagnostic && procedure) source = 'live_hvac_and_procedure'
  else if (hvacDiagnostic && memory.length) source = 'live_hvac_and_memory'
  else if (hvacDiagnostic) source = 'live_hvac_diagnostic'
  else if (procedure && memory.length) source = 'procedure_and_memory'
  else if (procedure) source = 'approved_internal_knowledge'
  else if (memory.length) source = 'verified_memory'
  else if (documents.length) source = 'approved_documentation'
  else if (sensors.length) source = 'live_sensor_context'

  const headline = !hasEvidence
    ? 'Conoscenza insufficiente per questo problema.'
    : hvacCheck
      ? hvacCheck
      : procedure?.title
        ? `Segui: ${procedure.title}`
        : memory[0]?.symptom
          ? `Caso simile in memoria: ${memory[0].symptom}`
          : 'Ho trovato evidenze utili: verifica i controlli sotto.'

  return Object.freeze({
    found: hasEvidence,
    reason: hasEvidence ? null : 'no_approved_knowledge',
    source,
    intent,
    section,
    resolvedQuery,
    headline,
    nextChecks: Object.freeze(hasEvidence ? nextChecks.slice(0, 5) : [...MISSING_CHECKS]),
    suggestions: Object.freeze(suggestions),
    procedure: procedure || null,
    equipment: Object.freeze([...(equipment || [])]),
    history: Object.freeze([...(history || [])]),
    documents: Object.freeze([...(documents || [])]),
    memory: Object.freeze([...(memory || [])]),
    sensors: Object.freeze([...(sensors || [])]),
    hvacDiagnostic: hvacDiagnostic || null,
  })
}
