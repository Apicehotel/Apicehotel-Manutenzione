export function classifyRepositoryGovernance({ branch = null, rulesets = null, repository = null } = {}) {
  const checked = Boolean(branch && typeof branch.protected === 'boolean')
  const activeRulesets = Array.isArray(rulesets)
    ? rulesets.filter((item) => String(item?.enforcement || '').toLowerCase() === 'active')
    : []

  if (!checked) {
    return Object.freeze({
      status: 'UNKNOWN',
      score: null,
      code: 'REPOSITORY_GOVERNANCE_UNKNOWN',
      title: 'Protezione repository non verificabile',
      detail: 'RandCore non ha ricevuto evidenza affidabile sulla protezione di main.',
      evidence: Object.freeze({ repository, branch_protected: null, active_rulesets: activeRulesets.length }),
    })
  }

  if (branch.protected !== true) {
    return Object.freeze({
      status: 'DEGRADED',
      score: 55,
      code: 'MAIN_BRANCH_UNPROTECTED',
      title: 'Branch main non protetta lato GitHub',
      detail: 'La policy branch + PR + revisione umana esiste nel progetto ma non è garantita dal server GitHub.',
      evidence: Object.freeze({ repository, branch_protected: false, active_rulesets: activeRulesets.length }),
    })
  }

  return Object.freeze({
    status: 'HEALTHY',
    score: 100,
    code: 'MAIN_BRANCH_PROTECTED',
    title: 'Branch main protetta lato GitHub',
    detail: activeRulesets.length > 0
      ? 'GitHub segnala main come protetta e sono presenti ruleset attive.'
      : 'GitHub segnala main come protetta; la protezione può provenire da branch protection classica.',
    evidence: Object.freeze({ repository, branch_protected: true, active_rulesets: activeRulesets.length }),
  })
}
