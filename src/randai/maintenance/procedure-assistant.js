import { KnowledgeTrust, normalizeText } from './contracts.js'

const STOPWORDS = new Set(['della','dello','delle','degli','alla','allo','alle','agli','nella','nello','nelle','negli','sono','come','questa','questo','quello','quella','con','per','dal','del','dei','una','uno','che'])

const makeId = (hotelId, title) => `${hotelId}-${normalizeText(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`

function inferCategory(text, hint) {
  if (hint) return hint
  const normalized = normalizeText(text)
  if (/acqua|contatore|valvol|rubinet/.test(normalized)) return 'acqua'
  if (/clima|condizion|hvac|temperatura/.test(normalized)) return 'climatizzazione'
  if (/ascensor|lift/.test(normalized)) return 'ascensori'
  if (/elettric|quadro|interruttor/.test(normalized)) return 'elettrico'
  if (/caldai|acs|acqua calda/.test(normalized)) return 'acs'
  return 'manutenzione'
}

function splitSteps(text) {
  const explicit = String(text).split(/(?:\n+|(?:^|\s)\d+[.)]\s+)/).map((part) => part.trim()).filter(Boolean)
  if (explicit.length > 1) return explicit
  const sentences = String(text).split(/[.;]\s+/).map((part) => part.trim()).filter(Boolean)
  return sentences.length > 1 ? sentences : []
}

function keywords(text, hints = {}) {
  const source = [text, hints.category, hints.area, hints.equipmentName].filter(Boolean).join(' ')
  return [...new Set(normalizeText(source).split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !STOPWORDS.has(word)))].slice(0, 16)
}

export class ProcedureAssistant {
  compose({ hotelId, text, hints = {}, attachments = [] } = {}) {
    if (!hotelId) throw new TypeError('hotelId is required')
    if (!String(text || '').trim()) throw new TypeError('Procedure source text is required')
    const category = inferCategory(text, hints.category)
    const area = hints.area || null
    const equipmentName = hints.equipmentName || null
    const title = hints.title || [area, equipmentName || category].filter(Boolean).join(' - ') || 'Procedura manutenzione'
    const steps = hints.steps?.length ? [...hints.steps] : splitSteps(text)
    const summary = hints.summary || String(text).trim()
    const missingFields = []
    if (!area) missingFields.push('area')
    if (!steps.length) missingFields.push('steps')

    return {
      status: 'DRAFT',
      trust: KnowledgeTrust.DRAFT,
      originalText: String(text),
      hotelId,
      requiresApproval: true,
      missingFields,
      proposal: {
        id: hints.id || makeId(hotelId, title),
        hotelId,
        title,
        category,
        area,
        symptom: hints.symptom || null,
        summary,
        keywords: keywords(text, { ...hints, category, area, equipmentName }),
        steps,
        caution: hints.caution || null,
        sourceLabel: hints.sourceLabel || 'Conoscenza fornita dallo staff - da approvare',
        trust: KnowledgeTrust.DRAFT,
        version: 1,
        equipment: equipmentName ? {
          id: hints.equipmentId || makeId(hotelId, equipmentName),
          hotelId,
          name: equipmentName,
          category,
          location: hints.location || null,
          description: hints.equipmentDescription || null,
          trust: KnowledgeTrust.DRAFT,
        } : null,
        evidence: attachments.map((attachment, index) => ({
          id: attachment.id || `${makeId(hotelId, title)}-evidence-${index + 1}`,
          hotelId,
          type: attachment.type || 'other',
          label: attachment.label || `Allegato ${index + 1}`,
          uri: attachment.uri || attachment.url || null,
          metadata: attachment.metadata || {},
          trust: KnowledgeTrust.DRAFT,
        })),
      },
    }
  }

  approve(draft, engine, { approvedBy = 'human' } = {}) {
    if (!draft?.requiresApproval || draft.trust !== KnowledgeTrust.DRAFT) throw new TypeError('Only a draft proposal can be approved')
    if (!engine) throw new TypeError('Maintenance knowledge engine is required')
    if (draft.missingFields?.length) throw new Error(`Procedure incomplete: ${draft.missingFields.join(', ')}`)
    const proposal = draft.proposal
    if (!proposal?.hotelId || proposal.hotelId !== draft.hotelId) throw new Error('Draft/proposal hotel scope mismatch')
    const procedure = engine.registerProcedure(proposal)
    if (proposal.equipment) {
      engine.registerEquipment({ ...proposal.equipment, trust: KnowledgeTrust.VERIFIED })
      if (proposal.area) engine.addRelation({ hotelId: proposal.hotelId, from: proposal.equipment.id, to: proposal.area, type: 'SERVES', note: 'Relazione proposta e approvata con la procedura' })
    }
    for (const item of proposal.evidence || []) {
      if (item.hotelId !== proposal.hotelId) throw new Error('Evidence hotel scope mismatch')
      engine.addEvidence({ ...item, procedureId: proposal.id, equipmentId: proposal.equipment?.id || null, trust: KnowledgeTrust.APPROVED })
    }
    return engine.approveProcedure(procedure.id, { hotelId: proposal.hotelId, approvedBy })
  }
}
