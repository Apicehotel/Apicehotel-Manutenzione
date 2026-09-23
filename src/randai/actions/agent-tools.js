import { listRandActions, mapRandActionInput } from './catalog.js'

function requireRegistry(registry) {
  if (!registry || typeof registry.register !== 'function') {
    throw new TypeError('Rand agent action bridge requires a ToolRegistry')
  }
}

export function registerRandActionTools({ registry, dispatch } = {}) {
  requireRegistry(registry)
  if (typeof dispatch !== 'function') {
    throw new TypeError('Rand agent action bridge requires a governed dispatch function')
  }

  return listRandActions({ surface: 'agent' }).map((action) => registry.register({
    id: action.id,
    name: action.title,
    description: action.description,
    risk: action.risk,
    permission: action.permission,
    idempotent: action.annotations.idempotentHint === true,
    async execute(input = {}, context = {}) {
      const { hotelId, resourceId, approvalId = null, ...actionInput } = input || {}
      if (!hotelId || !resourceId) {
        throw new TypeError(`Rand action ${action.id} requires hotelId and resourceId`)
      }
      return dispatch({
        actionId: action.id,
        hotelId,
        resourceId,
        approvalId,
        input: mapRandActionInput(action.id, actionInput),
        context,
      })
    },
  }))
}
