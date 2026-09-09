export const OpenAIPluginDisposition = Object.freeze({
  ADOPT_PATTERN: 'ADOPT_PATTERN',
  ADAPT: 'ADAPT',
  CONNECT: 'CONNECT',
  WATCH: 'WATCH',
  IGNORE: 'IGNORE',
})

export const OpenAIPluginAcquisitionMode = Object.freeze({
  REFERENCE_ONLY: 'REFERENCE_ONLY',
  CONNECTOR: 'CONNECTOR',
})

const PLUGINS = Object.freeze([
  Object.freeze({
    id: 'build-web-apps',
    upstreamPath: 'plugins/build-web-apps',
    upstreamLicense: 'MIT',
    disposition: OpenAIPluginDisposition.ADOPT_PATTERN,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY,
    owners: Object.freeze(['RandUI', 'RandSkills']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Use frontend, testing, React, shadcn and Supabase/Postgres guidance as curated development patterns without creating a second UI system.',
  }),
  Object.freeze({
    id: 'plugin-eval',
    upstreamPath: 'plugins/plugin-eval',
    upstreamLicense: 'MIT',
    disposition: OpenAIPluginDisposition.ADAPT,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY,
    owners: Object.freeze(['RandRadar', 'RandSkills']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Adapt evaluation and benchmark concepts into RandRadar so candidate skills/plugins are measured before adoption.',
  }),
  Object.freeze({
    id: 'codex-security',
    upstreamPath: 'plugins/codex-security',
    upstreamLicense: 'Proprietary',
    disposition: OpenAIPluginDisposition.CONNECT,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'May be invoked as an external security workflow when available; proprietary implementation is never vendored and RandCore remains the security authority.',
  }),
  Object.freeze({
    id: 'superpowers',
    upstreamPath: 'plugins/superpowers',
    upstreamLicense: 'MIT',
    disposition: OpenAIPluginDisposition.ADAPT,
    acquisitionMode: OpenAIPluginAcquisitionMode.REFERENCE_ONLY,
    owners: Object.freeze(['RandCore', 'RandSkills']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Adapt planning, TDD, systematic debugging and branch-finishing practices into RandFlow while preserving mandatory Rand human review.',
  }),
  Object.freeze({
    id: 'github',
    upstreamPath: 'plugins/github',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.CONNECT,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Connect repository/PR evidence behind existing governance; never grant autonomous main push or merge authority.',
  }),
  Object.freeze({
    id: 'supabase',
    upstreamPath: 'plugins/supabase',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.CONNECT,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Use as a controlled integration surface only; Supabase RLS/RPC remains final authorization authority.',
  }),
  Object.freeze({
    id: 'vercel',
    upstreamPath: 'plugins/vercel',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.CONNECT,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Use for deployment evidence and controlled actions only; production deploy remains subject to Rand release gates and current deployment freeze.',
  }),
  Object.freeze({
    id: 'figma',
    upstreamPath: 'plugins/figma',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.WATCH,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandUI']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Useful future RandUI design-system bridge after the current unified UI stabilizes.',
  }),
  Object.freeze({
    id: 'sentry',
    upstreamPath: 'plugins/sentry',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.WATCH,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Evaluate only as an interface to the Sentry capability already present; do not add a second observability stack.',
  }),
  Object.freeze({
    id: 'posthog',
    upstreamPath: 'plugins/posthog',
    upstreamLicense: 'UPSTREAM',
    disposition: OpenAIPluginDisposition.WATCH,
    acquisitionMode: OpenAIPluginAcquisitionMode.CONNECTOR,
    owners: Object.freeze(['RandCore']),
    automaticInstall: false,
    productionAuthority: false,
    rationale: 'Watch for future product analytics; require privacy, hotel-scope and overlap review before adoption.',
  }),
])

export function openAIPluginCandidates() {
  return PLUGINS.map((plugin) => ({ ...plugin, owners: [...plugin.owners] }))
}

export function assertGovernedOpenAIPlugin(plugin) {
  if (!plugin?.id || !plugin?.upstreamPath || !plugin?.disposition || !plugin?.acquisitionMode) {
    throw new TypeError('Invalid OpenAI plugin candidate')
  }
  if (!Array.isArray(plugin.owners) || plugin.owners.length === 0) throw new Error(`Plugin ${plugin.id} requires at least one canonical Rand owner`)
  if (plugin.automaticInstall !== false) throw new Error(`Plugin ${plugin.id} must not auto-install`)
  if (plugin.productionAuthority !== false) throw new Error(`Plugin ${plugin.id} must not receive production authority`)
  if (plugin.upstreamLicense === 'Proprietary' && plugin.acquisitionMode !== OpenAIPluginAcquisitionMode.CONNECTOR) {
    throw new Error(`Proprietary plugin ${plugin.id} must remain external`)
  }
  return true
}
