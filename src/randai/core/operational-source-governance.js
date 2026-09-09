export const OperationalSourceDisposition = Object.freeze({
  ADAPT: 'ADAPT',
  SOURCE_ONLY: 'SOURCE_ONLY',
  IGNORE_RUNTIME: 'IGNORE_RUNTIME',
})

export const RAND_OPERATIONAL_GROUP2_SOURCES = Object.freeze([
  Object.freeze({
    id: 'expensify',
    repository: 'Expensify/App',
    disposition: OperationalSourceDisposition.SOURCE_ONLY,
    owner: 'RandChat/RandApp',
    reason: 'Useful reference for offline-first operational UX and collaboration patterns; no second chat/account/runtime.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
  Object.freeze({
    id: 'cryptboard',
    repository: 'MihanEntalpo/cryptboard.io',
    disposition: OperationalSourceDisposition.IGNORE_RUNTIME,
    owner: 'RandChat',
    reason: 'RandChat already owns groups, DM E2EE, retention, media and permissions. A second messaging runtime would be zombie overlap.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
  Object.freeze({
    id: 'housekeeping-hotel',
    repository: 'Caxerion2/Sistem-Housekeeping-Hotel',
    disposition: OperationalSourceDisposition.ADAPT,
    owner: 'RandApp Housekeeping',
    reason: 'Adapt floor-oriented workflow only; keep RandApp identity, hotel scope, issues, warehouse and permissions canonical.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
  Object.freeze({
    id: 'magnitude',
    repository: 'magnitude-dev/magnitude',
    disposition: OperationalSourceDisposition.SOURCE_ONLY,
    owner: 'RandDev/Quality Matrix',
    reason: 'Browser-agent/testing ideas may inform QA but must not become a production automation authority.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
  Object.freeze({
    id: 'opencode',
    repository: 'anomalyco/opencode',
    disposition: OperationalSourceDisposition.SOURCE_ONLY,
    owner: 'RandFlow/RandAgent Runtime',
    reason: 'Coding-agent patterns only. RandFlow and the governed agent runtime remain canonical.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
  Object.freeze({
    id: 'reverse-skill',
    repository: 'zhaoxuya520/reverse-skill',
    disposition: OperationalSourceDisposition.SOURCE_ONLY,
    owner: 'RandCore Security Intelligence',
    reason: 'Analysis patterns only, sandbox/source intelligence; never remote exploit execution in production.',
    runtimeDependency: false,
    replacesCanonicalOwner: false,
  }),
])

export function assertOperationalGroup2Sources(sources = RAND_OPERATIONAL_GROUP2_SOURCES) {
  if (!Array.isArray(sources) || sources.length === 0) throw new TypeError('Operational source registry required')
  const ids = new Set()
  for (const source of sources) {
    if (!source?.id || !source?.repository || !source?.owner) throw new TypeError('Operational source identity is incomplete')
    if (!Object.values(OperationalSourceDisposition).includes(source.disposition)) throw new Error(`Unknown disposition for ${source.id}`)
    if (source.runtimeDependency !== false) throw new Error(`Operational source ${source.id} cannot become a runtime dependency`)
    if (source.replacesCanonicalOwner !== false) throw new Error(`Operational source ${source.id} cannot replace a canonical owner implicitly`)
    if (ids.has(source.id)) throw new Error(`Duplicate operational source ${source.id}`)
    ids.add(source.id)
  }
  return true
}

export function getOperationalGroup2Source(id) {
  return RAND_OPERATIONAL_GROUP2_SOURCES.find((source) => source.id === id) ?? null
}

assertOperationalGroup2Sources()
