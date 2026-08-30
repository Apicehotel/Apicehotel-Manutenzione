import { KnowledgeTrust } from './contracts.js'

const DB_TO_TRUST = Object.freeze({
  draft: KnowledgeTrust.DRAFT,
  approved: KnowledgeTrust.APPROVED,
  archived: KnowledgeTrust.OUTDATED,
  verified: KnowledgeTrust.VERIFIED,
  outdated: KnowledgeTrust.OUTDATED,
})

const TRUST_TO_DB = Object.freeze({
  [KnowledgeTrust.DRAFT]: 'draft',
  [KnowledgeTrust.APPROVED]: 'approved',
  [KnowledgeTrust.VERIFIED]: 'approved',
  [KnowledgeTrust.OUTDATED]: 'archived',
})

export function procedureFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    hotelId: row.hotel_id,
    title: row.title,
    category: row.category,
    area: row.area ?? null,
    symptom: row.symptom ?? null,
    summary: row.summary,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    caution: row.caution ?? null,
    sourceLabel: row.source_label || 'Procedura interna approvata',
    trust: DB_TO_TRUST[row.status] || KnowledgeTrust.DRAFT,
    version: Number(row.version || 1),
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

export function procedureToRow(procedure) {
  return {
    id: procedure.id,
    hotel_id: procedure.hotelId,
    title: procedure.title,
    category: procedure.category,
    area: procedure.area ?? null,
    symptom: procedure.symptom ?? null,
    summary: procedure.summary,
    keywords: procedure.keywords || [],
    steps: procedure.steps || [],
    caution: procedure.caution ?? null,
    source_label: procedure.sourceLabel || 'Conoscenza RandAI',
    status: TRUST_TO_DB[procedure.trust] || 'draft',
    version: Number(procedure.version || 1),
    approved_at: procedure.approvedAt ?? null,
  }
}

export function equipmentFromRow(row) {
  if (!row) return null
  return {
    id: row.id,
    hotelId: row.hotel_id,
    name: row.name,
    category: row.category,
    location: row.location ?? null,
    description: row.description ?? null,
    active: row.active !== false,
    trust: row.active === false ? KnowledgeTrust.OUTDATED : KnowledgeTrust.VERIFIED,
  }
}

export class MaintenanceSupabaseRepository {
  constructor(client) {
    if (!client) throw new TypeError('Supabase client is required')
    this.client = client
  }

  async listApprovedProcedures(hotelId) {
    const { data, error } = await this.client.from('randai_procedures').select('*').eq('hotel_id', hotelId).eq('status', 'approved')
    if (error) throw error
    return (data || []).map(procedureFromRow)
  }

  async saveProcedure(procedure) {
    const { data, error } = await this.client.from('randai_procedures').upsert(procedureToRow(procedure)).select('*').single()
    if (error) throw error
    return procedureFromRow(data)
  }

  async saveRevision(revision) {
    const payload = {
      procedure_id: revision.procedureId,
      hotel_id: revision.hotelId,
      version: revision.version,
      trust: String(revision.trust || KnowledgeTrust.DRAFT).toLowerCase(),
      change_note: revision.changeNote || null,
      snapshot: revision.snapshot,
    }
    const { data, error } = await this.client.from('randai_procedure_revisions').insert(payload).select('*').single()
    if (error) throw error
    return data
  }

  async saveEvidence(evidence) {
    const payload = {
      id: evidence.id,
      hotel_id: evidence.hotelId,
      procedure_id: evidence.procedureId || null,
      equipment_id: evidence.equipmentId || null,
      evidence_type: evidence.type,
      label: evidence.label,
      uri: evidence.uri || null,
      metadata: evidence.metadata || {},
      trust: String(evidence.trust || KnowledgeTrust.DRAFT).toLowerCase(),
    }
    const { data, error } = await this.client.from('randai_knowledge_evidence').upsert(payload).select('*').single()
    if (error) throw error
    return data
  }
}
