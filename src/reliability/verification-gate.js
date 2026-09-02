const text = (v) => String(v ?? '').trim()
const finite01 = (v, name) => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 1) throw new TypeError(`${name} must be finite 0..1`)
  return n
}

export const VerificationDecision = Object.freeze({ PASS: 'PASS', BLOCK: 'BLOCK', REVIEW: 'REVIEW' })

export function evaluateVerificationGate({
  hotelId,
  expectedHotelId = hotelId,
  checks = [],
  minScore = 0.8,
  requireIndependent = true,
  allowReview = true,
} = {}) {
  const scope = text(hotelId)
  if (!scope) throw new TypeError('hotelId is required')
  if (text(expectedHotelId) !== scope) return Object.freeze({ decision: VerificationDecision.BLOCK, score: 0, reasons: ['HOTEL_MISMATCH'] })
  if (!Array.isArray(checks) || checks.length === 0) throw new TypeError('checks are required')
  const threshold = finite01(minScore, 'minScore')
  const ids = new Set()
  let weighted = 0
  let weightTotal = 0
  let independent = 0
  const reasons = []
  for (const check of checks) {
    const id = text(check?.id)
    if (!id || ids.has(id)) throw new TypeError('verification check ids must be unique')
    ids.add(id)
    if (check.hotelId && text(check.hotelId) !== scope) return Object.freeze({ decision: VerificationDecision.BLOCK, score: 0, reasons: ['CHECK_HOTEL_MISMATCH'] })
    const score = finite01(check.score, `check ${id} score`)
    const weight = Number(check.weight ?? 1)
    if (!Number.isFinite(weight) || weight <= 0) throw new TypeError(`check ${id} weight must be > 0`)
    weighted += score * weight
    weightTotal += weight
    if (check.independent === true) independent += 1
    if (check.passed === false) reasons.push(`FAILED:${id}`)
  }
  const score = weighted / weightTotal
  if (reasons.length || (requireIndependent && independent === 0)) {
    if (requireIndependent && independent === 0) reasons.push('NO_INDEPENDENT_VERIFICATION')
    return Object.freeze({ decision: VerificationDecision.BLOCK, score, reasons: Object.freeze(reasons) })
  }
  if (score >= threshold) return Object.freeze({ decision: VerificationDecision.PASS, score, reasons: Object.freeze([]) })
  return Object.freeze({ decision: allowReview ? VerificationDecision.REVIEW : VerificationDecision.BLOCK, score, reasons: Object.freeze(['SCORE_BELOW_THRESHOLD']) })
}
