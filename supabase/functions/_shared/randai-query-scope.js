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

export function resolveRandAIQuery(query, contextQuery = '') {
  const clean = String(query || '').trim().slice(0, 1500)
  const context = String(contextQuery || '').trim().slice(0, 1500)
  if (!clean || !context || !isRandAIFollowUp(clean)) return clean
  return `${context}. Follow-up: ${clean}`.slice(0, 1500)
}

export function detectRandAIIntent(query) {
  const text = normalizeRandAIQuery(query)
  if (
    text.includes('dove') ||
    text.includes('si trova') ||
    text.includes('ubicaz') ||
    text.includes('posizion') ||
    text.includes('localizz') ||
    text.includes('collocat') ||
    text.includes('come ci arrivo') ||
    text.includes('come arriv') ||
    text.includes('come raggiung')
  ) return 'location'
  if (text.includes('temperatur') || text.includes('gradi') || /quanto.*grad/.test(text)) return 'temperature'
  if (
    text.includes('non fredd') ||
    text.includes('non raffresc') ||
    text.includes('non cald') ||
    text.includes('non riscald') ||
    text.includes('guast') ||
    text.includes('problema') ||
    text.includes('non funzion') ||
    text.includes('errore') ||
    text.includes('allarme')
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
