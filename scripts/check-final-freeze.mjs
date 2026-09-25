import fs from 'node:fs'
import { evaluateReleaseReadiness } from '../src/release/release-readiness.js'
import { RANDAPP_FREEZE } from '../src/release/freeze-policy.js'
import { collectRepositoryReleaseEvidence } from './release-evidence.mjs'

const read = (file) => fs.readFileSync(file, 'utf8')
const evidence = collectRepositoryReleaseEvidence()
const web = evaluateReleaseReadiness(evidence, { target: 'web' })
const android = evaluateReleaseReadiness(evidence, { target: 'android' })
const vercel = JSON.parse(read('vercel.json'))
const mainSource = read('src/main.jsx')
const readme = read('README.md')
const freezeDoc = read('docs/governance/RELEASE_FREEZE.md')

const invariants = {
  webReady: web.status === 'READY',
  vercelGitDeployDisabled: vercel.git?.deploymentEnabled === false,
  noZombiePreviewRuntime: !/ui-v2-preview|randui-v2\/Preview/.test(mainSource),
  humanReviewDocumented: /revisione umana|review umana/.test(readme),
  freezeDocumented: freezeDoc.includes('**FROZEN**') && freezeDoc.includes('12 mesi'),
  releaseGateDocumented: readme.includes('Web Release Readiness gate'),
}

const failed = Object.entries(invariants).filter(([, ok]) => !ok).map(([key]) => key)
const result = {
  schema: 'randapp.final-freeze.v1',
  status: failed.length === 0 ? RANDAPP_FREEZE.status : 'BLOCKED',
  releaseLine: RANDAPP_FREEZE.releaseLine,
  maintenanceHorizonMonths: RANDAPP_FREEZE.maintenanceHorizonMonths,
  commitSha: process.env.GITHUB_SHA || null,
  web,
  android,
  distribution: {
    webPwa: web.status,
    androidNative: android.status,
    iosPrivate: 'DEFERRED',
    windowsPwa: 'SUPPORTED',
    windowsNativeInstaller: 'DEFERRED',
  },
  invariants,
  failed,
}

fs.mkdirSync('artifacts', { recursive: true })
fs.writeFileSync('artifacts/randapp-final-freeze.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
if (result.status !== 'FROZEN') process.exitCode = 1
