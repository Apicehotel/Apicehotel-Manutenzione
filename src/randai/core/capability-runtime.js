import { supabase } from '../../supabase.js'
import { RandCapabilityRouter } from './capability-router.js'
import { createRandGatewayCapabilityProvider } from './capability-providers.js'

export const randCapabilityRouter = new RandCapabilityRouter()

randCapabilityRouter.register(createRandGatewayCapabilityProvider({
  isAvailable: () => Boolean(supabase),
}))
