import { DirectiveStatus, createDirectiveId } from './contracts.js'

export class DirectiveRegistry {
  #items = new Map()
  #sequence = 0

  create(composition, metadata = {}) {
    if (!composition?.requiresApproval || !composition?.original) throw new TypeError('Valid directive composition is required')
    const id = createDirectiveId(++this.#sequence)
    const record = Object.freeze({
      id,
      version: 1,
      status: DirectiveStatus.PROPOSED,
      createdAt: new Date().toISOString(),
      approvedAt: null,
      metadata: Object.freeze({ ...metadata }),
      ...composition,
    })
    this.#items.set(id, [record])
    return record
  }

  get(id) {
    const history = this.#items.get(id)
    return history?.[history.length - 1] ?? null
  }

  history(id) { return [...(this.#items.get(id) ?? [])] }
  list() { return [...this.#items.keys()].map(id => this.get(id)) }

  approve(id, changes = {}) {
    const current = this.get(id)
    if (!current) throw new Error(`Unknown directive: ${id}`)
    if (![DirectiveStatus.PROPOSED, DirectiveStatus.DRAFT].includes(current.status)) throw new Error(`Directive cannot be approved from ${current.status}`)
    const approved = Object.freeze({
      ...current,
      ...changes,
      id: current.id,
      version: current.version,
      original: current.original,
      status: DirectiveStatus.APPROVED,
      requiresApproval: false,
      approvedAt: new Date().toISOString(),
    })
    const history = this.#items.get(id)
    history[history.length - 1] = approved
    return approved
  }

  reject(id) {
    const current = this.get(id)
    if (!current) throw new Error(`Unknown directive: ${id}`)
    const rejected = Object.freeze({ ...current, status: DirectiveStatus.REJECTED })
    const history = this.#items.get(id)
    history[history.length - 1] = rejected
    return rejected
  }

  revise(id, changes = {}) {
    const current = this.get(id)
    if (!current) throw new Error(`Unknown directive: ${id}`)
    const history = this.#items.get(id)
    history[history.length - 1] = Object.freeze({ ...current, status: DirectiveStatus.SUPERSEDED })
    const next = Object.freeze({
      ...current,
      ...changes,
      id: current.id,
      original: current.original,
      version: current.version + 1,
      status: DirectiveStatus.PROPOSED,
      requiresApproval: true,
      approvedAt: null,
    })
    history.push(next)
    return next
  }
}
