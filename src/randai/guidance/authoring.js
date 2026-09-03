import { canonicalizeProcedure, isProcedurePublishable } from './catalog.js'

const lines = (value) => String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean)

export function structureProcedureDraft(rawText, { hotelId, title = '', category = 'generale', area = null } = {}) {
  const parts = lines(rawText)
  if (!hotelId || !parts.length) throw new TypeError('RandGuide authoring requires hotelId and raw text')
  const inferredTitle = title || parts[0].replace(/^[-*#\d.\s]+/, '').slice(0, 120)
  const body = parts.slice(title ? 0 : 1)
  const summary = (body[0] || parts[0]).replace(/^[-*#\d.\s]+/, '')
  const steps = body.slice(1).map((item, index) => ({ id:`step-${index+1}`, title:item.replace(/^[-*\d.)\s]+/, '') })).filter((step) => step.title)
  return canonicalizeProcedure({ hotelId, title:inferredTitle, summary, category, area, steps, status:'draft', sourceLabel:'Bozza assistita RandGuide', sourceConfidence:70 })
}

export async function composeProcedureDraft({ rawText, context = {}, modelAdapter = null } = {}) {
  const baseline = structureProcedureDraft(rawText, context)
  if (!modelAdapter) return Object.freeze({ draft:baseline, assisted:false, requiresApproval:true, suggestions:[] })
  const suggestion = await modelAdapter({
    task:'randguide-procedure-authoring',
    rules:['Do not invent locations, equipment, safety facts or credentials','Keep hotel scope','Return suggestions only; never publish'],
    draft:baseline,
  })
  const candidate = canonicalizeProcedure({ ...baseline, ...(suggestion?.procedure || {}), hotelId:baseline.hotelId, status:'draft' })
  return Object.freeze({ draft:candidate, assisted:true, requiresApproval:true, suggestions:Array.isArray(suggestion?.notes) ? suggestion.notes : [], publishability:isProcedurePublishable(candidate) })
}

export function approveProcedureDraft(draft, { approvedBy, now = new Date().toISOString() } = {}) {
  if (!approvedBy) throw new TypeError('RandGuide approval requires approvedBy')
  const procedure = canonicalizeProcedure({ ...draft, status:'approved', approvedAt:now })
  const gate = isProcedurePublishable(procedure, { now })
  if (!gate.publishable) throw new Error(`RandGuide procedure not publishable:${gate.blockers.join(',')}`)
  return Object.freeze({ ...procedure, approvedBy:String(approvedBy), approvedAt:now })
}
