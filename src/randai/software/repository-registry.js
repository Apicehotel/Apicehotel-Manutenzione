export const IMPLEMENTED_REPOSITORIES = Object.freeze([
  Object.freeze({
    id: 'randailive',
    name: 'RandAIlive',
    repository: 'Apicehotel/RandAIlive',
    url: 'https://github.com/Apicehotel/RandAIlive',
    project: 'Rand ecosystem',
    usage: 'Runtime/game project collegato e mantenuto separatamente da RandApp/RandAI.',
    evidence: 'README.md dichiara RandAIlive come repository separato ufficiale.',
    tracking: 'commit',
    trackedSha: '8b5139088e8fc6ffb02f6b0db7795148dc3f447e',
  }),
  Object.freeze({
    id: 'impeccable',
    name: 'Impeccable',
    repository: 'pbakaus/impeccable',
    url: 'https://github.com/pbakaus/impeccable',
    project: 'RandUI / visual QA',
    usage: 'Regole e contesto di design usati per i controlli grafici RandUI.',
    evidence: '.impeccable/DESIGN.md e .impeccable/PRODUCT.md presenti nel repository.',
    tracking: 'commit',
    trackedSha: '114ea1d3838fca73b253af45f873b9c4f5f213c8',
  }),
  Object.freeze({
    id: 'apicehotel-manutenzione',
    name: 'Apicehotel-Manutenzione',
    repository: 'Apicehotel/Apicehotel-Manutenzione',
    url: 'https://github.com/Apicehotel/Apicehotel-Manutenzione',
    project: 'RandApp / RandAI / RandCore',
    usage: 'Repository principale dell\'ecosistema operativo.',
    evidence: 'Repository corrente.',
    tracking: 'managed-here',
    trackedSha: null,
  }),
])

export const RepositoryUpdateStatus = Object.freeze({
  CURRENT: 'CURRENT',
  UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
  MANAGED_HERE: 'MANAGED_HERE',
  CHECK_FAILED: 'CHECK_FAILED',
})

export function listImplementedRepositories() {
  return IMPLEMENTED_REPOSITORIES.map((item) => ({ ...item }))
}
