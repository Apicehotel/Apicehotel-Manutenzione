export const RepoRadarSourceRole = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  SECURITY_INTELLIGENCE: 'SECURITY_INTELLIGENCE',
  ANALYSIS_PATTERN: 'ANALYSIS_PATTERN',
  CAPABILITY_CATALOG: 'CAPABILITY_CATALOG',
})

export const RepoRadarSourceMode = Object.freeze({
  SOURCE_ONLY: 'SOURCE_ONLY',
  SANDBOX_ONLY: 'SANDBOX_ONLY',
})

const SOURCES = Object.freeze([
  Object.freeze({
    id: 'exploitarium',
    name: 'Exploitarium',
    repository: 'https://github.com/bikini/exploitarium',
    role: RepoRadarSourceRole.SECURITY_INTELLIGENCE,
    mode: RepoRadarSourceMode.SOURCE_ONLY,
    automaticInstall: false,
    productionExecution: false,
    note: 'Public exploit/PoC intelligence. Never execute PoCs automatically in production.',
  }),
  Object.freeze({
    id: 'reverse-skill',
    name: 'reverse-skill',
    repository: 'https://github.com/zhaoxuya520/reverse-skill',
    role: RepoRadarSourceRole.ANALYSIS_PATTERN,
    mode: RepoRadarSourceMode.SANDBOX_ONLY,
    automaticInstall: false,
    productionExecution: false,
    note: 'Reverse-engineering workflow donor. Analysis may run only in an isolated authorized lab.',
  }),
  Object.freeze({
    id: 'nosignups',
    name: 'NoSignups / FckSignups',
    repository: 'https://github.com/BraveOPotato/FckSignups',
    role: RepoRadarSourceRole.DISCOVERY,
    mode: RepoRadarSourceMode.SOURCE_ONLY,
    automaticInstall: false,
    productionExecution: false,
    note: 'Candidate discovery feed only; every downstream repository is re-evaluated by RandRadar.',
  }),
  Object.freeze({
    id: 'openai-plugins',
    name: 'OpenAI Plugins',
    repository: 'https://github.com/openai/plugins',
    role: RepoRadarSourceRole.CAPABILITY_CATALOG,
    mode: RepoRadarSourceMode.SOURCE_ONLY,
    automaticInstall: false,
    productionExecution: false,
    note: 'Official Codex plugin catalog used for governed capability scouting. No plugin is copied, installed, trusted, or granted production authority automatically.',
  }),
])

export function repoRadarIntelligenceSources() {
  return SOURCES.map((source) => ({ ...source }))
}

export function assertSafeSource(source) {
  if (!source?.id || !source?.repository || !source?.role || !source?.mode) throw new TypeError('Invalid Repo Radar source')
  if (source.automaticInstall !== false) throw new Error(`Source ${source.id} must not auto-install code`)
  if (source.productionExecution !== false) throw new Error(`Source ${source.id} must not execute in production`)
  return true
}
