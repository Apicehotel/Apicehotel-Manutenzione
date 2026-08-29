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
  if (
    text.includes('dove') ||
    text.includes('si trova') ||
    text.includes('ubicaz') ||
    text.includes('posizion') ||
    text.includes('localizz') ||
    text.includes('collocat')
  ) return 'location'
  if (text.includes('temperatur') || text.includes('gradi') || /quanto.*grad/.test(text)) return 'temperature'
  if (
    text.includes('non fredd') ||
    text.includes('non raffresc') ||
    text.includes('non cald') ||
    text.includes('non riscald') ||
    text.includes('guast') ||
    text.includes('problema') ||
    text.includes('non funzion')
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
