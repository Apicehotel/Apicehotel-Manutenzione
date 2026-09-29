import { submitRandGatewayEnvelope } from '../../randgateway-client.js'

export const RandCapability = Object.freeze({
  OPERATIONAL_ACTION: 'operational.action',
})

export function createRandGatewayCapabilityProvider({
  submit = submitRandGatewayEnvelope,
  isAvailable = () => true,
} = {}) {
  if (typeof submit !== 'function') throw new TypeError('submit deve essere una funzione')

  return {
    id: 'randgateway',
    capabilities: [RandCapability.OPERATIONAL_ACTION],
    priority: 10,
    isAvailable,
    getHealth: async ({ context } = {}) => ({
      status: await isAvailable({ capability: RandCapability.OPERATIONAL_ACTION, context }) ? 'HEALTHY' : 'DISABLED',
    }),
    execute: async ({ input }) => submit(input?.envelope),
  }
}
