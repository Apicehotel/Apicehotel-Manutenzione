import fs from 'node:fs'
import { evaluateReleaseReadiness } from '../src/release/release-readiness.js'

const read = (file) => fs.readFileSync(file, 'utf8')
const pkg = JSON.parse(read('package.json'))
const ci = read('.github/workflows/ci.yml')
const ocean = read('.github/workflows/digitalocean-preview.yml')
const vercel = JSON.parse(read('vercel.json'))
const targetArg = process.argv.find((arg) => arg.startsWith('--target='))
const target = targetArg?.split('=')[1] || 'web'

const evidence = {
  quality: Boolean(pkg.scripts['test:quality'] && ci.includes('npm run test:matrix')),
  build: Boolean(pkg.scripts.build && ci.includes('npm run build')),
  audit: ci.includes('npm audit'),
  e2e: Boolean(pkg.scripts['test:e2e'] && fs.existsSync('test/e2e.mjs')),
  device: Boolean(pkg.scripts['test:device'] && fs.existsSync('test/device-acceptance.mjs') && fs.existsSync('docs/DEVICE_ACCEPTANCE.md')),
  rollback: fs.existsSync('docs/architecture/RANDAI_GROUP3_ZOMBIE_SCAN.md') || fs.existsSync('scripts/check-legacy.mjs'),
  environmentSeparation: vercel.git?.deploymentEnabled === false && ocean.includes('environment: preview') && !ocean.includes('environment: production'),
  humanReview: read('README.md').includes('revisione umana') || read('README.md').includes('review umana'),
  signedPackage: process.env.ANDROID_SIGNED_PACKAGE_VERIFIED === 'true',
  realDevice: process.env.ANDROID_REAL_DEVICE_VERIFIED === 'true',
}

const result = evaluateReleaseReadiness(evidence, { target })
console.log(JSON.stringify(result, null, 2))
if (result.status !== 'READY') process.exitCode = 1
