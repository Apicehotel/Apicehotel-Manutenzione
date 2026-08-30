const SENTENCE_SPLIT = /(?:\n+|(?<=[.!?;])\s+)/

function unique(values) {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))]
}

function classifySentence(sentence) {
  const text = sentence.trim()
  const lower = text.toLowerCase()
  if (!text) return null
  if (/\b(non|mai|evita|vietato|senza)\b/.test(lower)) return { bucket: 'forbidden', value: text }
  if (/\b(build|test|verifica|controlla|diff|head|pass|successo|funzioni|funzionare)\b/.test(lower)) return { bucket: 'successCriteria', value: text }
  return { bucket: 'rules', value: text }
}

export function composeDirective(rawText, { title = 'Direttiva RandAI', scope = 'randai', objective = null } = {}) {
  if (typeof rawText !== 'string' || rawText.trim().length < 8) throw new TypeError('Directive text is too short')
  const original = rawText.trim()
  const sentences = original.split(SENTENCE_SPLIT).map(value => value.trim()).filter(Boolean)
  const buckets = { rules: [], forbidden: [], successCriteria: [] }
  for (const sentence of sentences) {
    const classified = classifySentence(sentence)
    if (classified) buckets[classified.bucket].push(classified.value)
  }

  return Object.freeze({
    title,
    scope,
    original,
    objective: objective || sentences[0],
    rules: Object.freeze(unique(buckets.rules)),
    forbidden: Object.freeze(unique(buckets.forbidden)),
    successCriteria: Object.freeze(unique(buckets.successCriteria)),
    suggestions: Object.freeze([]),
    requiresApproval: true,
  })
}
