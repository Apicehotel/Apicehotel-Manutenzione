import { supabase } from '../../supabase.js'
import { RandCapabilityRouter } from './capability-router.js'
import { createMcpBrokerCapabilityProvider, createRandGatewayCapabilityProvider } from './capability-providers.js'

export const randCapabilityRouter = new RandCapabilityRouter()

randCapabilityRouter.register(createRandGatewayCapabilityProvider({
  isAvailable: () => Boolean(supabase),
}))

randCapabilityRouter.register(createMcpBrokerCapabilityProvider({
  isAvailable: () => Boolean(supabase),
}))
