export function normalizeRandAIQuery(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function detectRandAISection(query) {
  const text = normalizeRandAIQuery(query)
  const hasJazz = /\bjazz\b/.test(text)
  const hasWine = /\bwine\b/.test(text)
  if (hasJazz && !hasWine) return 'jazz'
  if (hasWine && !hasJazz) return 'wine'
  return null
}

export function isRandAIFollowUp(query) {
  const text = normalizeRandAIQuery(query).trim().replace(/[?!.,;:]+$/g, '')
  if (!text) return false
  if (detectRandAISection(text) || /\b\d{3,4}\b/.test(text)) return false
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length > 8) return false
  return (
    /^(dove|come|quale|quali|quanto|quanta|quanti|quante|perche|cosa|che cosa)\b/.test(text) ||
    /^(e|ed)\s+(il|lo|la|i|gli|le|l'|se|poi|prima|dopo|invece)\b/.test(text) ||
    /^(prima|dopo|poi|li|la|lo|quello|quella|questo|questa)\b/.test(text) ||
    /^(temperatura|temperature|ingresso|uscita|errore|errori|display)\b/.test(text)
  )
}

export function extractRandAITopic(contextQuery) {
  return String(contextQuery || '').split(/\.\s*Follow-up:/i)[0].trim().slice(0, 1200)
}

export function resolveRandAIQuery(query, contextQuery = '') {
  const clean = String(query || '').trim().slice(0, 1500)
  const context = extractRandAITopic(contextQuery)
  if (!clean || !context || !isRandAIFollowUp(clean)) return clean
  return `${context}. Follow-up: ${clean}`.slice(0, 1500)
}

export function detectRandAIIntent(query) {
  const text = normalizeRandAIQuery(query)
  const followUp = text.split(/follow-up:/).pop()?.trim() || text
  if (
    followUp.includes('dove') ||
    followUp.includes('si trova') ||
    followUp.includes('ubicaz') ||
    followUp.includes('posizion') ||
    followUp.includes('localizz') ||
    followUp.includes('collocat') ||
    followUp.includes('come ci arrivo') ||
    followUp.includes('come arriv') ||
    followUp.includes('come raggiung')
  ) return 'location'
  if (followUp.includes('temperatur') || followUp.includes('gradi') || /quanto.*grad/.test(followUp)) return 'temperature'
  if (
    followUp.includes('non fredd') ||
    followUp.includes('non raffresc') ||
    followUp.includes('non cald') ||
    followUp.includes('non riscald') ||
    followUp.includes('guast') ||
    followUp.includes('problema') ||
    followUp.includes('non funzion') ||
    followUp.includes('errore') ||
    followUp.includes('allarme')
  ) return 'diagnostic'
  return 'general'
}

export function filterSensorsBySection(sensors, section) {
  if (!section) return Array.isArray(sensors) ? sensors : []
  return (Array.isArray(sensors) ? sensors : []).filter((sensor) => {
    const zone = normalizeRandAIQuery(sensor?.zone)
    const label = normalizeRandAIQuery(sensor?.semantic_label)
    if (section === 'jazz') return zone.includes('jazz') || label.includes('jazz')
    if (section === 'wine') return zone.includes('wine') || label.includes('wine')
    return true
  })
}

export function scopeGuidanceForQuery({ query, contextQuery = '', sensors = [], hvacDiagnostic = null, memory = [], procedure = null, history = [] }) {
  const resolvedQuery = resolveRandAIQuery(query, contextQuery)
  const section = detectRandAISection(resolvedQuery)
  const intent = detectRandAIIntent(resolvedQuery)
  const scopedSensors = filterSensorsBySection(sensors, section)

  if (intent === 'location') {
    return {
      resolvedQuery,
      section,
      intent,
      sensors: [],
      hvacDiagnostic: null,
      memory: [],
      procedure: null,
      history: [],
    }
  }

  return {
    resolvedQuery,
    section,
    intent,
    sensors: scopedSensors,
    hvacDiagnostic: hvacDiagnostic && (!section || hvacDiagnostic.section === section) ? hvacDiagnostic : null,
    memory,
    procedure,
    history,
  }
}
