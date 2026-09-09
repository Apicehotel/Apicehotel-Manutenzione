import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OpenAIPluginAcquisitionMode,
  OpenAIPluginDisposition,
  assertGovernedOpenAIPlugin,
  openAIPluginCandidates,
} from '../src/randai/discovery/openai-plugin-catalog.js'

test('OpenAI plugin catalog is unique, bounded and fail-closed', () => {
  const plugins = openAIPluginCandidates()
  const ids = plugins.map((plugin) => plugin.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(plugins.length >= 7)
  assert.ok(plugins.every((plugin) => assertGovernedOpenAIPlugin(plugin)))
  assert.ok(plugins.every((plugin) => plugin.automaticInstall === false))
  assert.ok(plugins.every((plugin) => plugin.productionAuthority === false))
})

test('priority plugins have explicit Rand ownership and adoption decisions', () => {
  const byId = new Map(openAIPluginCandidates().map((plugin) => [plugin.id, plugin]))
  assert.equal(byId.get('build-web-apps').disposition, OpenAIPluginDisposition.ADOPT_PATTERN)
  assert.deepEqual(byId.get('build-web-apps').owners, ['RandUI', 'RandSkills'])
  assert.equal(byId.get('plugin-eval').disposition, OpenAIPluginDisposition.ADAPT)
  assert.ok(byId.get('plugin-eval').owners.includes('RandRadar'))
  assert.equal(byId.get('superpowers').disposition, OpenAIPluginDisposition.ADAPT)
  assert.equal(byId.get('github').disposition, OpenAIPluginDisposition.CONNECT)
  assert.equal(byId.get('supabase').disposition, OpenAIPluginDisposition.CONNECT)
  assert.equal(byId.get('vercel').disposition, OpenAIPluginDisposition.CONNECT)
})

test('proprietary security plugin stays external and cannot become a vendored authority', () => {
  const security = openAIPluginCandidates().find((plugin) => plugin.id === 'codex-security')
  assert.equal(security.upstreamLicense, 'Proprietary')
  assert.equal(security.acquisitionMode, OpenAIPluginAcquisitionMode.CONNECTOR)
  assert.equal(security.productionAuthority, false)
  assert.ok(security.owners.includes('RandCore'))
})

test('governance rejects unsafe or orphan plugin candidates', () => {
  assert.throws(() => assertGovernedOpenAIPlugin({
    id: 'unsafe', upstreamPath: 'plugins/unsafe', disposition: OpenAIPluginDisposition.ADAPT,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY, owners: ['RandRadar'], automaticInstall: true, productionAuthority: false,
  }), /must not auto-install/)
  assert.throws(() => assertGovernedOpenAIPlugin({
    id: 'orphan', upstreamPath: 'plugins/orphan', disposition: OpenAIPluginDisposition.WATCH,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY, owners: [], automaticInstall: false, productionAuthority: false,
  }), /canonical Rand owner/)
  assert.throws(() => assertGovernedOpenAIPlugin({
    id: 'proprietary-copy', upstreamPath: 'plugins/private', upstreamLicense: 'Proprietary', disposition: OpenAIPluginDisposition.ADAPT,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY, owners: ['RandCore'], automaticInstall: false, productionAuthority: false,
  }), /must remain external/)
})
