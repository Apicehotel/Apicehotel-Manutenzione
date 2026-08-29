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

export function detectRandAIIntent(query) {
  const text = normalizeRandAIQuery(query)
  if (/\b(dove|ubicaz|posizion|localizz|collocat|si trova|trova il|trova la)\b/.test(text)) return 'location'
  if (/\b(temperatur|quanto.*grad|gradi)\b/.test(text)) return 'temperature'
  if (/\b(non fredd|non raffresc|non cald|non riscald|guast|problema|non funzion)\b/.test(text)) return 'diagnostic'
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

export function scopeGuidanceForQuery({ query, sensors = [], hvacDiagnostic = null, memory = [], procedure = null, history = [] }) {
  const section = detectRandAISection(query)
  const intent = detectRandAIIntent(query)
  const scopedSensors = filterSensorsBySection(sensors, section)

  if (intent === 'location') {
    return {
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
    section,
    intent,
    sensors: scopedSensors,
    hvacDiagnostic: hvacDiagnostic && (!section || hvacDiagnostic.section === section) ? hvacDiagnostic : null,
    memory,
    procedure,
    history,
  }
}
