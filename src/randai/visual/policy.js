export const RandVisualKind = Object.freeze({
  DIAGRAM: 'DIAGRAM',
  INFOGRAPHIC: 'INFOGRAPHIC',
  PROCEDURE_VISUAL: 'PROCEDURE_VISUAL',
  IMAGE: 'IMAGE',
})

export const RandVisualSourceRole = Object.freeze({
  ADAPT: 'ADAPT',
  SOURCE_ONLY: 'SOURCE_ONLY',
})

export const RAND_VISUAL_SOURCES = Object.freeze([
  Object.freeze({
    id: 'diagram-design',
    repository: 'cathrynlavery/diagram-design',
    role: RandVisualSourceRole.ADAPT,
    purpose: 'Editorial HTML/SVG diagram grammar and accessibility patterns',
    runtimeDependency: false,
    remoteExecution: false,
  }),
  Object.freeze({
    id: 'awesome-gpt-image-2',
    repository: 'freestylefly/awesome-gpt-image-2',
    role: RandVisualSourceRole.SOURCE_ONLY,
    purpose: 'Prompt-template taxonomy and visual-direction references',
    runtimeDependency: false,
    remoteExecution: false,
    copyThirdPartyCasePrompts: false,
    commercialRightsReviewRequired: true,
  }),
])

const HTML_SVG_KINDS = new Set([
  RandVisualKind.DIAGRAM,
  RandVisualKind.PROCEDURE_VISUAL,
])

function requireText(value, label) {
  const normalized = String(value ?? '').trim()
  if (!normalized) throw new TypeError(`${label} is required`)
  return normalized
}

export function assertRandVisualSources(sources = RAND_VISUAL_SOURCES) {
  const ids = new Set()
  for (const source of sources) {
    if (!source?.id || !source?.repository) throw new TypeError('Invalid RandVisual source')
    if (!Object.values(RandVisualSourceRole).includes(source.role)) throw new TypeError(`Invalid RandVisual source role: ${source.id}`)
    if (source.runtimeDependency !== false) throw new TypeError(`RandVisual source cannot become a runtime dependency: ${source.id}`)
    if (source.remoteExecution !== false) throw new TypeError(`RandVisual source cannot execute remotely: ${source.id}`)
    if (ids.has(source.id)) throw new TypeError(`Duplicate RandVisual source: ${source.id}`)
    ids.add(source.id)
  }
  return true
}

export function createRandVisualRequest({
  hotelId,
  kind,
  objective,
  audience = 'HOTEL_STAFF',
  locale = 'it-IT',
  dataRefs = [],
  sensitive = false,
} = {}) {
  const normalizedHotelId = requireText(hotelId, 'hotelId')
  const normalizedObjective = requireText(objective, 'objective')
  if (!Object.values(RandVisualKind).includes(kind)) throw new TypeError('Unsupported RandVisual kind')
  if (!Array.isArray(dataRefs)) throw new TypeError('dataRefs must be an array')

  return Object.freeze({
    hotelId: normalizedHotelId,
    kind,
    objective: normalizedObjective,
    audience: requireText(audience, 'audience'),
    locale: requireText(locale, 'locale'),
    dataRefs: Object.freeze(dataRefs.map((ref) => requireText(ref, 'dataRef'))),
    sensitive: Boolean(sensitive),
  })
}

export function createRandVisualPlan(request) {
  if (!request?.hotelId || !request?.objective) throw new TypeError('Governed RandVisual request required')

  const htmlSvg = HTML_SVG_KINDS.has(request.kind)
  const pipeline = htmlSvg ? 'EDITORIAL_HTML_SVG' : 'GENERATIVE_IMAGE_PROMPT'
  const sourceIds = htmlSvg ? ['diagram-design'] : ['awesome-gpt-image-2']

  return Object.freeze({
    version: 1,
    hotelId: request.hotelId,
    kind: request.kind,
    pipeline,
    sourceIds: Object.freeze(sourceIds),
    outputAuthority: 'DRAFT_UNTIL_USER_OR_WORKFLOW_APPROVAL',
    renderBoundary: htmlSvg ? 'SANDBOXED_SELF_CONTAINED_HTML_SVG' : 'APPROVED_IMAGE_PROVIDER_ONLY',
    provenanceRequired: true,
    hotelScopeRequired: true,
    allowRemoteCodeExecution: false,
    allowRuntimeSourceInstall: false,
    copyThirdPartyCasePrompts: false,
    commercialRightsReviewRequired: !htmlSvg,
    dataPolicy: request.sensitive ? 'MINIMIZE_AND_REDACT_BEFORE_RENDER' : 'AUTHORIZED_REFERENCES_ONLY',
  })
}

export function getRandVisualSource(id) {
  return RAND_VISUAL_SOURCES.find((source) => source.id === id) ?? null
}
