import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Phase 0 keeps every channel behind the Point 7 execution chain', () => {
  const gateway = read('supabase/functions/_shared/rand-gateway/gateway.js')
  const client = read('src/randai/action-gateway.js')
  const architecture = read('docs/architecture/RANDGATEWAY_POINT7.md')

  assert.match(gateway, /this\.identity\.resolve/)
  assert.match(gateway, /this\.tools\.authorize/)
  assert.match(gateway, /this\.hitl\.verify/)
  assert.match(gateway, /this\.actions\.execute/)
  assert.match(gateway, /this\.#audit/)
  assert.match(client, /submitRandGatewayEnvelope/)
  assert.doesNotMatch(client, /functions\.invoke\(['"]randai-action-gateway/)
  assert.match(architecture, /RandGateway.*Tool Gateway.*RandSecure.*HITL.*Action Gateway.*RandAudit/s)
})

test('Phase 0 keeps Control Center at /randai while primary nav opens the chat', () => {
  const main = read('src/main.jsx')
  const navigation = read('src/randapp/shell-navigation.js')
  const shell = read('src/randapp/Shell.jsx')

  assert.match(main, /randaiConsoleMatch/)
  assert.match(main, /<RandAIProtectedRoute \/>/)
  assert.match(navigation, /id:\s*'randai'.*label:\s*'RandAI'/)
  assert.doesNotMatch(navigation, /href:\s*'\/randai'/)
  assert.match(shell, /if \(item\.id === 'randai'\)/)
  assert.match(shell, /data-testid="header-randai"/)
  assert.match(shell, /new CustomEvent\('randai-toggle'\)/)
})

test('Phase 0 allows reviewed Vercel production deploys and keeps Ocean preview-only', () => {
  const vercel = JSON.parse(read('vercel.json'))
  const preview = read('.github/workflows/digitalocean-preview.yml')

  assert.equal(vercel.git?.deploymentEnabled, true)
  assert.equal(existsSync(new URL('../.github/workflows/digitalocean-deploy.yml', import.meta.url)), false)
  assert.match(preview, /pull_request:/)
  assert.match(preview, /workflow_dispatch:/)
  assert.match(preview, /environment: preview/)
  assert.doesNotMatch(preview, /environment: production/)
  assert.doesNotMatch(preview, /vercel/i)
})
