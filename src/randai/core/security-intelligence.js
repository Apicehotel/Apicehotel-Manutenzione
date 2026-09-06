export const SecurityExposureLevel = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
})

function baseLevel({ severity = 'LOW', exploitPublic = false, productionExposed = false, patchAvailable = false } = {}) {
  const normalized = String(severity || 'LOW').toUpperCase()
  let score = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[normalized] || 1
  if (exploitPublic) score += 1
  if (productionExposed) score += 1
  if (patchAvailable) score -= 1
  return [null, SecurityExposureLevel.LOW, SecurityExposureLevel.MEDIUM, SecurityExposureLevel.HIGH, SecurityExposureLevel.CRITICAL][Math.max(1, Math.min(4, score))]
}

export function evaluateSecurityExposure(finding = {}) {
  if (!finding.component || !finding.affectedVersion) throw new TypeError('Security finding requires component and affectedVersion')
  const level = baseLevel(finding)
  return Object.freeze({
    component: String(finding.component),
    affectedVersion: String(finding.affectedVersion),
    advisoryId: finding.advisoryId || null,
    exploitPublic: finding.exploitPublic === true,
    productionExposed: finding.productionExposed === true,
    patchAvailable: finding.patchAvailable === true,
    fixedVersion: finding.fixedVersion || null,
    source: finding.source || null,
    level,
    action: level === SecurityExposureLevel.CRITICAL
      ? 'PATCH_OR_ISOLATE_NOW'
      : level === SecurityExposureLevel.HIGH
        ? 'PRIORITIZE_PATCH'
        : level === SecurityExposureLevel.MEDIUM
          ? 'SCHEDULE_REMEDIATION'
          : 'MONITOR',
    automaticExploitExecution: false,
  })
}

export function correlateSecurityFindings(findings = [], inventory = []) {
  if (!Array.isArray(findings) || !Array.isArray(inventory)) throw new TypeError('findings and inventory must be arrays')
  const versions = new Map(inventory.map((item) => [String(item.component), String(item.version)]))
  return findings
    .filter((finding) => versions.get(String(finding.component)) === String(finding.affectedVersion))
    .map(evaluateSecurityExposure)
    .sort((a, b) => ['LOW','MEDIUM','HIGH','CRITICAL'].indexOf(b.level) - ['LOW','MEDIUM','HIGH','CRITICAL'].indexOf(a.level))
}
