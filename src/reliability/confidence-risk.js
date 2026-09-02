const finite01 = (v, name) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(`${name} must be finite 0..1`)
  return n
}

export const ActionDisposition = Object.freeze({ AUTO: 'AUTO', REVIEW: 'REVIEW', BLOCK: 'BLOCK' })

export function evaluateOperationalConfidence({ verification, evidenceTrust, contextCompleteness, actionRisk, critical = false } = {}) {
  const verificationScore = finite01(verification, 'verification')
  const trustScore = finite01(evidenceTrust, 'evidenceTrust')
  const contextScore = finite01(contextCompleteness, 'contextCompleteness')
  const risk = finite01(actionRisk, 'actionRisk')
  const confidence = (verificationScore * 0.45) + (trustScore * 0.35) + (contextScore * 0.20)
  const adjusted = Math.max(0, Math.min(1, confidence * (1 - (risk * 0.5))))
  let disposition = ActionDisposition.REVIEW
  if (critical || risk >= 0.8 || adjusted < 0.5) disposition = ActionDisposition.BLOCK
  else if (risk <= 0.3 && adjusted >= 0.85) disposition = ActionDisposition.AUTO
  return Object.freeze({ confidence, adjustedConfidence: adjusted, risk, critical: Boolean(critical), disposition })
}
