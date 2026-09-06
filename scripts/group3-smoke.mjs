import { RandDurableRuntime } from '../src/randai/core/durable-runtime.js'
const runtime = new RandDurableRuntime()
const context = { actor: { id: 'smoke' }, hotelId: 'gio', grantedScopes: ['workflow:execute'] }
const workflow = { id: 'smoke', version: '1', execute: async () => ({ output: 'ok' }) }
const run = await runtime.start({ workflow, context, idempotencyKey: 'smoke' })
if (run.status !== 'SUCCEEDED') process.exitCode = 1
