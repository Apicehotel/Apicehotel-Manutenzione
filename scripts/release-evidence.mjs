import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

export function collectRepositoryReleaseEvidence({ env = process.env } = {}) {
  const pkg = JSON.parse(read('package.json'))
  const ci = read('.github/workflows/ci.yml')
  const ocean = read('.github/workflows/digitalocean-preview.yml')
  const vercel = JSON.parse(read('vercel.json'))
  const readme = read('README.md')

  return {
    quality: Boolean(pkg.scripts['test:quality'] && ci.includes('npm run test:matrix')),
    build: Boolean(pkg.scripts.build && ci.includes('npm run build')),
    audit: ci.includes('npm audit'),
    e2e: Boolean(pkg.scripts['test:e2e'] && fs.existsSync('test/e2e.mjs')),
    device: Boolean(pkg.scripts['test:device'] && fs.existsSync('test/device-acceptance.mjs') && fs.existsSync('docs/DEVICE_ACCEPTANCE.md')),
    rollback: fs.existsSync('src/deployment-recovery.js') && readme.includes('rollback'),
    environmentSeparation: vercel.git?.deploymentEnabled === false && ocean.includes('environment: preview') && !ocean.includes('environment: production'),
    humanReview: readme.includes('revisione umana') || readme.includes('review umana'),
    signedPackage: env.ANDROID_SIGNED_PACKAGE_VERIFIED === 'true',
    realDevice: env.ANDROID_REAL_DEVICE_VERIFIED === 'true',
  }
}
