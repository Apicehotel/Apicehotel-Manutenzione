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
const scopedKey = (hotelId, id) => `${hotelId}\u0000${id}`
const requireScope = (hotelId) => {
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
    const key = scopedKey(input.hotelId, input.id)
    if (this.#procedures.has(key)) throw new Error(`Procedure already registered in hotel ${input.hotelId}: ${input.id}`)
    const procedure = {
      category: 'manutenzione', area: null, symptom: null, keywords: [], steps: [], caution: null,
      sourceLabel: 'Conoscenza RandAI', version: 1, trust: KnowledgeTrust.DRAFT,
      approvedAt: null, approvedBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      ...clone(input),
    }
    this.#procedures.set(key, procedure)
    this.#snapshot(procedure, 'initial')
    return clone(procedure)
  }

  getProcedure(id, { hotelId } = {}) {
    requireScope(hotelId)
    const item = this.#procedures.get(scopedKey(hotelId, id))
    return item ? clone(item) : null
  }

  listProcedures({ hotelId, includeOutdated = false } = {}) {
    requireScope(hotelId)
    return [...this.#procedures.values()]
      .filter((item) => item.hotelId === hotelId && (includeOutdated || item.trust !== KnowledgeTrust.OUTDATED))
      .map(clone)
  }

  approveProcedure(id, { hotelId, approvedBy = 'human', approvedAt = new Date().toISOString() } = {}) {
    const procedure = this.#requireProcedure(id, hotelId)
    procedure.trust = KnowledgeTrust.APPROVED
    procedure.approvedBy = approvedBy
    procedure.approvedAt = approvedAt
    procedure.updatedAt = approvedAt
    this.#snapshot(procedure, 'approved')
    return clone(procedure)
  }

  verifyProcedure(id, { hotelId, verifiedBy = 'human', verifiedAt = new Date().toISOString() } = {}) {
    const procedure = this.#requireProcedure(id, hotelId)
    procedure.trust = KnowledgeTrust.VERIFIED
    procedure.verifiedBy = verifiedBy
    procedure.verifiedAt = verifiedAt
    procedure.updatedAt = verifiedAt
    this.#snapshot(procedure, 'verified')
    return clone(procedure)
  }

  reviseProcedure(id, patch, { hotelId, changeNote = 'revision' } = {}) {
    const current = this.#requireProcedure(id, hotelId)
    if (patch?.hotelId && patch.hotelId !== current.hotelId) throw new Error('Procedure hotelId cannot be changed by revision')
    if (patch?.id && patch.id !== current.id) throw new Error('Procedure id cannot be changed by revision')
    const nextVersion = Number(current.version || 1) + 1
    const previous = clone(current)
    previous.trust = KnowledgeTrust.OUTDATED
    this.#snapshot(previous, 'superseded')
    Object.assign(current, clone(patch), {
      id: current.id,
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
    requireScope(hotelId)
    return clone(this.#revisions.get(scopedKey(hotelId, id)) || [])
  }

  searchAll({ hotelId, query, allowedTrust = [KnowledgeTrust.APPROVED, KnowledgeTrust.VERIFIED] } = {}) {
    if (!hotelId || !normalizeText(query)) return []
    const allowed = new Set(allowedTrust)
    return [...this.#procedures.values()]
      .filter((item) => item.hotelId === hotelId && allowed.has(item.trust))
      .map((item) => ({ item, score: scoreText(item, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || (TRUST_RANK[b.item.trust] || 0) - (TRUST_RANK[a.item.trust] || 0))
      .map(({ item, score }) => ({ item: clone(item), score }))
  }

  search({ hotelId, query, allowedTrust = [KnowledgeTrust.APPROVED, KnowledgeTrust.VERIFIED] } = {}) {
    const ranked = this.searchAll({ hotelId, query, allowedTrust })
    if (!ranked.length) return this.unknown({ hotelId, query })
    const { item: procedure, score } = ranked[0]
    return { found: true, trust: procedure.trust, procedure, score }
  }

  unknown({ hotelId = null, query = '' } = {}) {
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
    const key = scopedKey(input.hotelId, input.id)
    if (this.#equipment.has(key)) throw new Error(`Equipment already registered in hotel ${input.hotelId}: ${input.id}`)
    const item = { category: 'impianto', location: null, description: null, active: true, trust: KnowledgeTrust.DRAFT, ...clone(input) }
    this.#equipment.set(key, item)
    return clone(item)
  }

  getEquipment(id, { hotelId } = {}) {
    requireScope(hotelId)
    const item = this.#equipment.get(scopedKey(hotelId, id))
    return item ? clone(item) : null
  }

  findEquipmentForArea({ hotelId, area } = {}) {
    requireScope(hotelId)
    const needle = normalizeText(area)
    const ids = this.#relations
      .filter((relation) => relation.hotelId === hotelId && relation.type === RelationType.SERVES && normalizeText(relation.to) === needle)
      .map((relation) => relation.from)
    return ids.map((id) => this.#equipment.get(scopedKey(hotelId, id))).filter(Boolean).map(clone)
  }

  addRelation(input) {
    assertHotelScope(input)
    if (!input.from || !input.to || !Object.values(RelationType).includes(input.type)) throw new TypeError('Invalid knowledge relation')
    const relation = { note: null, ...clone(input) }
    const duplicate = this.#relations.some((item) => item.hotelId === relation.hotelId && item.from === relation.from && item.to === relation.to && item.type === relation.type)
    if (duplicate) throw new Error(`Duplicate knowledge relation in hotel ${relation.hotelId}`)
    this.#relations.push(relation)
    return clone(relation)
  }

  getRelations({ hotelId, entityId, type } = {}) {
    requireScope(hotelId)
    return this.#relations.filter((item) => item.hotelId === hotelId && (!entityId || item.from === entityId || item.to === entityId) && (!type || item.type === type)).map(clone)
  }

  addEvidence(input) {
    assertHotelScope(input)
    if (!input.id || !input.type || !input.label) throw new TypeError('Evidence requires id, type and label')
    const evidence = { trust: KnowledgeTrust.DRAFT, procedureId: null, equipmentId: null, uri: null, metadata: {}, ...clone(input) }
    if (!evidence.procedureId && !evidence.equipmentId) throw new TypeError('Evidence must link a procedure or equipment')
    if (evidence.procedureId && !this.#procedures.has(scopedKey(evidence.hotelId, evidence.procedureId))) throw new Error(`Unknown procedure in evidence scope: ${evidence.procedureId}`)
    if (evidence.equipmentId && !this.#equipment.has(scopedKey(evidence.hotelId, evidence.equipmentId))) throw new Error(`Unknown equipment in evidence scope: ${evidence.equipmentId}`)
    const duplicate = this.#evidence.some((item) => item.hotelId === evidence.hotelId && item.id === evidence.id)
    if (duplicate) throw new Error(`Evidence already registered in hotel ${evidence.hotelId}: ${evidence.id}`)
    this.#evidence.push(evidence)
    return clone(evidence)
  }

  getEvidence({ hotelId, procedureId, equipmentId } = {}) {
    requireScope(hotelId)
    return this.#evidence.filter((item) => item.hotelId === hotelId && (!procedureId || item.procedureId === procedureId) && (!equipmentId || item.equipmentId === equipmentId)).map(clone)
  }

  #requireProcedure(id, hotelId) {
    requireScope(hotelId)
    const item = this.#procedures.get(scopedKey(hotelId, id))
    if (!item) throw new Error(`Unknown procedure in hotel ${hotelId}: ${id}`)
    return item
  }

  #snapshot(procedure, changeNote) {
    const key = scopedKey(procedure.hotelId, procedure.id)
    const history = this.#revisions.get(key) || []
    history.push({ procedureId: procedure.id, hotelId: procedure.hotelId, version: procedure.version, trust: procedure.trust, changeNote, snapshot: clone(procedure), createdAt: new Date().toISOString() })
    this.#revisions.set(key, history)
  }
}
