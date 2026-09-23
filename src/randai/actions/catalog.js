const SURFACES = Object.freeze(['randapp', 'agent', 'mcp'])

function freezeDefinition(definition) {
  return Object.freeze({
    ...definition,
    surfaces: Object.freeze({ ...definition.surfaces }),
    annotations: Object.freeze({ ...definition.annotations }),
    fields: Object.freeze(definition.fields.map((field) => Object.freeze({ ...field }))),
  })
}

const definitions = [
  {
    id: 'issue.update_priority',
    title: 'Cambia urgenza segnalazione',
    description: 'Prepara o esegue, dopo conferma Rand, una modifica di urgenza hotel-scoped.',
    resourceType: 'issue',
    permission: 'WRITE_PROTECTED',
    risk: 'MEDIUM',
    needsApproval: true,
    surfaces: { randapp: true, agent: true, mcp: true, public: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    fields: [{ name: 'priority', kind: 'enum', values: ['alta', 'media', 'bassa'], required: true }],
    toGatewayInput: ({ priority }) => ({ priority }),
  },
  {
    id: 'issue.set_waiting_part',
    title: 'Segnalazione in attesa ricambio',
    description: 'Prepara o esegue, dopo conferma Rand, lo stato di attesa ricambio.',
    resourceType: 'issue',
    permission: 'WRITE_PROTECTED',
    risk: 'MEDIUM',
    needsApproval: true,
    surfaces: { randapp: true, agent: true, mcp: true, public: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    fields: [{ name: 'partName', kind: 'string', min: 1, max: 180, required: true }],
    toGatewayInput: ({ partName }) => ({ part_name: partName }),
  },
  {
    id: 'issue.mark_done',
    title: 'Completa segnalazione',
    description: 'Prepara o esegue, dopo conferma Rand, il completamento di una segnalazione.',
    resourceType: 'issue',
    permission: 'WRITE_PROTECTED',
    risk: 'HIGH',
    needsApproval: true,
    surfaces: { randapp: true, agent: true, mcp: true, public: false },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    fields: [{ name: 'completionNote', kind: 'string', max: 800, required: false }],
    toGatewayInput: ({ completionNote }) => ({ completion_note: completionNote || null }),
  },
].map(freezeDefinition)

const byId = new Map(definitions.map((definition) => [definition.id, definition]))

export function getRandActionDefinition(id) {
  return byId.get(String(id || '').trim()) || null
}

export function listRandActions({ surface } = {}) {
  if (!surface) return [...definitions]
  if (!SURFACES.includes(surface)) throw new TypeError(`Unknown Rand action surface: ${surface}`)
  return definitions.filter((definition) => definition.surfaces[surface] === true)
}

export function assertRandActionSurface(id, surface) {
  const definition = getRandActionDefinition(id)
  if (!definition || definition.surfaces?.[surface] !== true) {
    throw new TypeError(`Rand action not available on ${surface}: ${id}`)
  }
  return definition
}

export function mapRandActionInput(id, input = {}) {
  const definition = getRandActionDefinition(id)
  if (!definition) throw new TypeError(`Unknown Rand action: ${id}`)
  return definition.toGatewayInput(input)
}
