import catalog from './ui-learning-catalog.json' with { type: 'json' }

export const RANDUI_LEARNING_VERSION = catalog.version
export const RANDUI_UI_KNOWLEDGE = Object.freeze(catalog)

export function uiPatternKnowledge(patternId) {
  const pattern = catalog.patternFamilies?.[patternId]
  return pattern ? Object.freeze({ id: patternId, ...pattern }) : null
}

export function recommendUiPatterns({ pageType = '', goal = '' } = {}) {
  const text = `${pageType} ${goal}`.toLowerCase()
  const ranked = Object.entries(catalog.patternFamilies || {}).map(([id, pattern]) => {
    const haystack = [id, ...(pattern.goodFor || [])].join(' ').toLowerCase()
    const score = text.split(/\s+/).filter(Boolean).reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0)
    return { id, score, ...pattern }
  })
  return ranked.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

export function uiSourceKnowledge(sourceId) {
  const source = (catalog.sources || []).find((item) => item.id === sourceId)
  return source ? Object.freeze({ ...source }) : null
}
