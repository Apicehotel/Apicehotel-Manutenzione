import { EcosystemStatus, assertRandEcosystemManifest, getRandEcosystemManifest } from './ecosystem.js'

export const RAND_LTS_VERSION = '1.0'
export const RAND_LTS_REQUIRED_LIVE = Object.freeze(['randapp','randai','randcore','randcontrol','reporadar','warehouse'])

const freezeList = (items) => Object.freeze(items.map((item) => Object.freeze({ ...item, evidence: Object.freeze([...(item.evidence || [])]) })))

export function evaluateRandLtsReadiness({ modules = getRandEcosystemManifest(), requiredLive = RAND_LTS_REQUIRED_LIVE } = {}) {
  assertRandEcosystemManifest(modules)
  const byId = new Map(modules.map((module) => [module.id, module]))
  const blockers = []

  for (const id of requiredLive) {
    const module = byId.get(id)
    if (!module) blockers.push({ code: 'REQUIRED_MODULE_MISSING', moduleId: id })
    else if (module.status !== EcosystemStatus.LIVE) blockers.push({ code: 'REQUIRED_MODULE_NOT_LIVE', moduleId: id, status: module.status })
    else if (!module.evidence?.length) blockers.push({ code: 'REQUIRED_MODULE_WITHOUT_EVIDENCE', moduleId: id })
  }

  for (const module of modules) {
    if (module.status === EcosystemStatus.ZOMBIE) blockers.push({ code: 'CANONICAL_ZOMBIE_PRESENT', moduleId: module.id })
  }

  const included = modules.filter((module) => module.status === EcosystemStatus.LIVE)
  const deferred = modules.filter((module) => module.status !== EcosystemStatus.LIVE && module.status !== EcosystemStatus.ZOMBIE)

  return Object.freeze({
    schema: 'rand.ecosystem-lts-readiness.v1',
    version: RAND_LTS_VERSION,
    ready: blockers.length === 0,
    blockers: Object.freeze(blockers.map((item) => Object.freeze({ ...item }))),
    requiredLive: Object.freeze([...requiredLive]),
    included: freezeList(included),
    deferred: freezeList(deferred),
    zombieCount: modules.filter((module) => module.status === EcosystemStatus.ZOMBIE).length,
  })
}

export function assertRandLtsReadiness(input) {
  const result = evaluateRandLtsReadiness(input)
  if (!result.ready) {
    const error = new Error('RAND_LTS_NOT_READY')
    error.code = 'RAND_LTS_NOT_READY'
    error.result = result
    throw error
  }
  return result
}

export function buildRandLtsAttestation({ commitSha, checks = {}, generatedAt = new Date().toISOString(), modules } = {}) {
  const readiness = assertRandLtsReadiness({ modules })
  const requiredChecks = ['security','quality','critical','multihotel','production','build','contracts','browser','device','warehouse','ecosystem']
  const failedChecks = requiredChecks.filter((name) => checks[name] !== true)
  if (!String(commitSha || '').trim()) throw new TypeError('commitSha is required')
  if (failedChecks.length) {
    const error = new Error('RAND_LTS_CHECK_FAILED')
    error.code = 'RAND_LTS_CHECK_FAILED'
    error.failedChecks = Object.freeze(failedChecks)
    throw error
  }
  return Object.freeze({
    schema: 'rand.ecosystem-lts-attestation.v1',
    release: `Rand Ecosystem LTS ${RAND_LTS_VERSION}`,
    commitSha: String(commitSha).trim(),
    generatedAt: String(generatedAt),
    checks: Object.freeze({ ...checks }),
    includedModules: Object.freeze(readiness.included.map((module) => module.id)),
    deferredModules: Object.freeze(readiness.deferred.map((module) => Object.freeze({ id: module.id, status: module.status }))),
    zeroCanonicalZombies: readiness.zombieCount === 0,
  })
}
