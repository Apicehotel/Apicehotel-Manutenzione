export const RandVisualSourceRole = Object.freeze({
  ADAPT: 'ADAPT',
  SOURCE_ONLY: 'SOURCE_ONLY',
})

export const RAND_VISUAL_SOURCES = Object.freeze([
  Object.freeze({
    id: 'diagram-design',
    repository: 'cathrynlavery/diagram-design',
    role: RandVisualSourceRole.ADAPT,
    purpose: 'Editorial diagram grammar, hierarchy and accessibility patterns',
    runtimeDependency: false,
    remoteExecution: false,
    commercialRightsReviewRequired: false,
  }),
  Object.freeze({
    id: 'awesome-gpt-image-2',
    repository: 'freestylefly/awesome-gpt-image-2',
    role: RandVisualSourceRole.SOURCE_ONLY,
    purpose: 'Visual prompt taxonomy and reference patterns for image generation',
    runtimeDependency: false,
    remoteExecution: false,
    copyThirdPartyCasePrompts: false,
    commercialRightsReviewRequired: true,
  }),
])

export function assertRandVisualSources(sources = RAND_VISUAL_SOURCES) {
  if (!Array.isArray(sources)) throw new TypeError('RandVisual sources must be an array')
  const ids = new Set()
  for (const source of sources) {
    if (!String(source?.id || '').trim()) throw new TypeError('RandVisual source id is required')
    if (!String(source?.repository || '').trim()) throw new TypeError(`RandVisual repository is required: ${source?.id || 'unknown'}`)
    if (!Object.values(RandVisualSourceRole).includes(source.role)) throw new TypeError(`Invalid RandVisual source role: ${source.id}`)
    if (source.runtimeDependency !== false) throw new TypeError(`RandVisual source cannot become a runtime dependency: ${source.id}`)
    if (source.remoteExecution !== false) throw new TypeError(`RandVisual source cannot execute remote code: ${source.id}`)
    if (ids.has(source.id)) throw new TypeError(`Duplicate RandVisual source: ${source.id}`)
    ids.add(source.id)
  }
  return true
}

export function getRandVisualSource(id) {
  return RAND_VISUAL_SOURCES.find((source) => source.id === id) ?? null
}

export function createRandVisualImagePlan({ hotelId, objective, sensitive = false } = {}) {
  const normalizedHotelId = String(hotelId || '').trim()
  const normalizedObjective = String(objective || '').trim()
  if (!normalizedHotelId) throw new TypeError('RandVisual image plan requires hotelId')
  if (!normalizedObjective) throw new TypeError('RandVisual image plan requires objective')

  return Object.freeze({
    version: 1,
    hotelId: normalizedHotelId,
    objective: normalizedObjective,
    pipeline: 'GENERATIVE_IMAGE_PROMPT',
    sourceIds: Object.freeze(['awesome-gpt-image-2']),
    outputAuthority: 'DRAFT_UNTIL_USER_OR_WORKFLOW_APPROVAL',
    providerBoundary: 'APPROVED_IMAGE_PROVIDER_ONLY',
    provenanceRequired: true,
    allowRemoteCodeExecution: false,
    allowRuntimeSourceInstall: false,
    copyThirdPartyCasePrompts: false,
    commercialRightsReviewRequired: true,
    dataPolicy: sensitive ? 'MINIMIZE_AND_REDACT_BEFORE_RENDER' : 'AUTHORIZED_REFERENCES_ONLY',
  })
}

assertRandVisualSources()
