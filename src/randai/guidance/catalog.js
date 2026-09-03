const clean = (value) => String(value ?? '').trim()
const uniq = (values) => [...new Set((values || []).map(clean).filter(Boolean))]

export const RandGuideKind = Object.freeze({
  PROCEDURE: 'procedure',
  LOCATION: 'location',
  EQUIPMENT: 'equipment',
  EMERGENCY: 'emergency',
  TROUBLESHOOTING: 'troubleshooting',
  REFERENCE: 'reference',
})

export const RandGuideRisk = Object.freeze({ LOW:'low', NORMAL:'normal', HIGH:'high', CRITICAL:'critical' })
export const RandGuidePublication = Object.freeze({ DRAFT:'draft', APPROVED:'approved', ARCHIVED:'archived' })

export function canonicalizeProcedure(input = {}) {
  const hotelId = clean(input.hotelId || input.hotel_id)
  const title = clean(input.title)
  const summary = clean(input.summary)
  if (!hotelId || !title || !summary) throw new TypeError('RandGuide procedure requires hotelId, title and summary')
  const kind = Object.values(RandGuideKind).includes(input.kind || input.procedure_kind) ? (input.kind || input.procedure_kind) : RandGuideKind.PROCEDURE
  const riskLevel = Object.values(RandGuideRisk).includes(input.riskLevel || input.risk_level) ? (input.riskLevel || input.risk_level) : RandGuideRisk.NORMAL
  const status = Object.values(RandGuidePublication).includes(input.status) ? input.status : RandGuidePublication.DRAFT
  const steps = Array.isArray(input.steps) ? input.steps.map((step, index) => typeof step === 'string' ? { id:`step-${index+1}`, title:clean(step) } : { ...step, id:clean(step.id) || `step-${index+1}`, title:clean(step.title || step.text) }).filter((step) => step.title) : []
  return Object.freeze({
    id:clean(input.id) || null, hotelId, title, summary, kind, riskLevel, status,
    category:clean(input.category) || 'generale', area:clean(input.area) || null,
    symptom:clean(input.symptom) || null, caution:clean(input.caution) || null,
    steps:Object.freeze(steps), keywords:Object.freeze(uniq(input.keywords)),
    locationPath:Object.freeze(uniq(input.locationPath || input.location_path)),
    equipmentIds:Object.freeze(uniq(input.equipmentIds || input.equipment_ids)),
    sourceLabel:clean(input.sourceLabel || input.source_label) || 'Conoscenza interna RandGuide',
    sourceConfidence:Math.max(0, Math.min(100, Number(input.sourceConfidence ?? input.source_confidence ?? 100))),
    version:Math.max(1, Number(input.version || 1)),
    reviewDueAt:input.reviewDueAt || input.review_due_at || null,
    approvedAt:input.approvedAt || input.approved_at || null,
  })
}

export function procedureContentFingerprint(input) {
  const p = canonicalizeProcedure(input)
  return JSON.stringify({ hotelId:p.hotelId,title:p.title.toLowerCase(),summary:p.summary,kind:p.kind,riskLevel:p.riskLevel,category:p.category,area:p.area,symptom:p.symptom,steps:p.steps,caution:p.caution,locationPath:p.locationPath,equipmentIds:p.equipmentIds,sourceLabel:p.sourceLabel })
}

export function isProcedurePublishable(input, { now = new Date().toISOString() } = {}) {
  const p = canonicalizeProcedure(input)
  const blockers = []
  if (!p.steps.length && ![RandGuideKind.LOCATION, RandGuideKind.REFERENCE].includes(p.kind)) blockers.push('MISSING_STEPS')
  if (p.riskLevel === RandGuideRisk.CRITICAL && !p.caution) blockers.push('CRITICAL_WITHOUT_CAUTION')
  if (p.sourceConfidence < 60) blockers.push('LOW_SOURCE_CONFIDENCE')
  if (p.reviewDueAt && Date.parse(p.reviewDueAt) <= Date.parse(now)) blockers.push('REVIEW_EXPIRED')
  return Object.freeze({ publishable:blockers.length === 0, blockers:Object.freeze(blockers) })
}
