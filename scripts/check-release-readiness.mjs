import { evaluateReleaseReadiness } from '../src/release/release-readiness.js'
import { collectRepositoryReleaseEvidence } from './release-evidence.mjs'

const targetArg = process.argv.find((arg) => arg.startsWith('--target='))
const target = targetArg?.split('=')[1] || 'web'
const evidence = collectRepositoryReleaseEvidence()
const result = evaluateReleaseReadiness(evidence, { target })

console.log(JSON.stringify(result, null, 2))
if (result.status !== 'READY') process.exitCode = 1
