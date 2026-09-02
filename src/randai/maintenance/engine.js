import { KnowledgeTrust, RelationType, assertHotelScope, normalizeText } from './contracts.js'

const TRUST_RANK = Object.freeze({
  [KnowledgeTrust.APPROVED]: 5,
  [KnowledgeTrust.VERIFIED]: 4,
  [KnowledgeTrust.DRAFT]: 2,
  [KnowledgeTrust.AI_SUGGESTION]: 1,
  [KnowledgeTrust.OUTDATED]: 0,
  [KnowledgeTrust.UNKNOWN]: -1,
})

const clone = (value) => structuredClone(value)
const requireHotelId = (hotelId) => {
  if (!hotelId) throw new TypeError('hotelId is required')
  return hotelId
}

function searchableProcedure(procedure) {
  return normalizeText([
    procedure.title,
    procedure.category,
    procedure.area,
    procedure.symptom,
    procedure.summary,
    ...(procedure.keywords || []),
  ].filter(Boolean).join(' '))
}

function scoreText(record, query) {
  const haystack = searchableProcedure(record)
  const tokens = normalizeText(query).split(/\s+/).filter((token) => token.length > 2)
  if (!tokens.length) return 0
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0)
}

export class MaintenanceKnowledgeEngine {
  #procedures = new Map()
  #revisions = new Map()
  #equipment = new Map()
  #relations = []
  #evidence = []

  constructor({ procedures = [], equipment = [], relations = [], evidence = [] } = {}) {
    procedures.forEach((item) => this.registerProcedure(item))
    equipment.forEach((item) => this.registerEquipment(item))
    relations.forEach((item) => this.addRelation(item))
    evidence.forEach((item) => this.addEvidence(item))
  }

  registerProcedure(input) {
    assertHotelScope(input)
    if (!input.id || !input.title || !input.summary) throw new TypeError('Procedure requires id, title and summary')
    if (this.#procedures.has(input.id)) throw new Error(`Procedure already registered: ${input.id}`)
    const procedure = {
      category: 'manutenzione', area: null, symptom: null, keywords: [], steps: [], caution: null,
      sourceLabel: 'Conoscenza RandAI', version: 1, trust: KnowledgeTrust.DRAFT,
      approvedAt: null, approvedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...clone(input),
    }
    this.#procedures.set(procedure.id, procedure)
    this.#snapshot(procedure, 'initial')
    return clone(procedure)
  }

  getProcedure(id, { hotelId } = {}) {
    const item = this.#requireProcedure(id, requireHotelId(hotelId))
    return clone(item)
  }

  listProcedures({ hotelId, includeOutdated = false } = {}) {
    requireHotelId(hotelId)
    return [...this.#procedures.values()]
      .filter((item) => item.hotelId === hotelId && (includeOutdated || item.trust !== KnowledgeTrust.OUTDATED))
      .map(clone)
  }

  approveProcedure(id, { hotelId, approvedBy = 'human', approvedAt = new Date().toISOString() } = {}) {
    const procedure = this.#requireProcedure(id, requireHotelId(hotelId))
    procedure.trust = KnowledgeTrust.APPROVED
    procedure.approvedBy = approvedBy
    procedure.approvedAt = approvedAt
    procedure.updatedAt = approvedAt
    this.#snapshot(procedure, 'approved')
    return clone(procedure)
  }

  verifyProcedure(id, { hotelId, verifiedBy = 'human', verifiedAt = new Date().toISOString() } = {}) {
    const procedure = this.#requireProcedure(id, requireHotelId(hotelId))
    procedure.trust = KnowledgeTrust.VERIFIED
    procedure.verifiedBy = verifiedBy
    procedure.verifiedAt = verifiedAt
    procedure.updatedAt = verifiedAt
    this.#snapshot(procedure, 'verified')
    return clone(procedure)
  }

  reviseProcedure(id, patch, { hotelId, changeNote = 'revision' } = {}) {
    const current = this.#requireProcedure(id, requireHotelId(hotelId))
    const nextVersion = Number(current.version || 1) + 1
    const previous = clone(current)
    previous.trust = KnowledgeTrust.OUTDATED
    this.#snapshot(previous, 'superseded')
    Object.assign(current, clone(patch), {
      hotelId: current.hotelId,
      version: nextVersion,
      trust: KnowledgeTrust.DRAFT,
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date().toISOString(),
    })
    this.#snapshot(current, changeNote)
    return clone(current)
  }

  getRevisionHistory(id, { hotelId } = {}) {
    const scopedHotelId = requireHotelId(hotelId)
    this.#requireProcedure(id, scopedHotelId)
    return clone((this.#revisions.get(id) || []).filter((entry) => entry.hotelId === scopedHotelId))
  }

  search({ hotelId, query, allowedTrust = [KnowledgeTrust.APPROVED, KnowledgeTrust.VERIFIED] } = {}) {
    requireHotelId(hotelId)
    if (!normalizeText(query)) return this.unknown({ hotelId, query })
    const allowed = new Set(allowedTrust)
    const ranked = [...this.#procedures.values()]
      .filter((item) => item.hotelId === hotelId && allowed.has(item.trust))
      .map((item) => ({ item, score: scoreText(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (TRUST_RANK[b.item.trust] || 0) - (TRUST_RANK[a.item.trust] || 0))
    if (!ranked.length) return this.unknown({ hotelId, query })
    const procedure = clone(ranked[0].item)
    return { found: true, trust: procedure.trust, procedure, score: ranked[0].score }
  }

  unknown({ hotelId, query = '' } = {}) {
    requireHotelId(hotelId)
    return {
      found: false,
      trust: KnowledgeTrust.UNKNOWN,
      hotelId,
      query,
      message: 'Informazione verificata non disponibile. RandAI non deve inventare posizione o procedura.',
    }
  }

  registerEquipment(input) {
    assertHotelScope(input)
    if (!input.id || !input.name) throw new TypeError('Equipment requires id and name')
    const item = { category: 'impianto', location: null, description: null, active: true, trust: KnowledgeTrust.DRAFT, ...clone(input) }
    this.#equipment.set(item.id, item)
    return clone(item)
  }

  getEquipment(id, { hotelId } = {}) {
    const scopedHotelId = requireHotelId(hotelId)
    const item = this.#equipment.get(id)
    if (!item || item.hotelId !== scopedHotelId) return null
    return clone(item)
  }

  findEquipmentForArea({ hotelId, area } = {}) {
    requireHotelId(hotelId)
    const needle = normalizeText(area)
    const ids = this.#relations
      .filter((relation) => relation.hotelId === hotelId && relation.type === RelationType.SERVES && normalizeText(relation.to) === needle)
      .map((relation) => relation.from)
    return ids.map((id) => this.#equipment.get(id)).filter((item) => item?.hotelId === hotelId).map(clone)
  }

  addRelation(input) {
    assertHotelScope(input)
    if (!input.from || !input.to || !Object.values(RelationType).includes(input.type)) throw new TypeError('Invalid knowledge relation')
    const relation = { note: null, ...clone(input) }
    this.#relations.push(relation)
    return clone(relation)
  }

  getRelations({ hotelId, entityId, type } = {}) {
    requireHotelId(hotelId)
    return this.#relations.filter((item) => item.hotelId === hotelId && (!entityId || item.from === entityId || item.to === entityId) && (!type || item.type === type)).map(clone)
  }

  addEvidence(input) {
    assertHotelScope(input)
    if (!input.id || !input.type || !input.label) throw new TypeError('Evidence requires id, type and label')
    const evidence = { trust: KnowledgeTrust.DRAFT, procedureId: null, equipmentId: null, uri: null, metadata: {}, ...clone(input) }
    if (!evidence.procedureId && !evidence.equipmentId) throw new TypeError('Evidence must link a procedure or equipment')
    this.#evidence.push(evidence)
    return clone(evidence)
  }

  getEvidence({ hotelId, procedureId, equipmentId } = {}) {
    requireHotelId(hotelId)
    return this.#evidence.filter((item) => item.hotelId === hotelId && (!procedureId || item.procedureId === procedureId) && (!equipmentId || item.equipmentId === equipmentId)).map(clone)
  }

  #requireProcedure(id, hotelId) {
    const item = this.#procedures.get(id)
    if (!item || item.hotelId !== hotelId) throw new Error(`Unknown procedure in hotel scope: ${id}`)
    return item
  }

  #snapshot(procedure, changeNote) {
    const history = this.#revisions.get(procedure.id) || []
    history.push({ procedureId: procedure.id, hotelId: procedure.hotelId, version: procedure.version, trust: procedure.trust, changeNote, snapshot: clone(procedure), createdAt: new Date().toISOString() })
    this.#revisions.set(procedure.id, history)
  }
}
