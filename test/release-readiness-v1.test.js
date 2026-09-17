import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evaluateReleaseReadiness, releaseEvidenceKeys } from '../src/release/release-readiness.js'

const complete = (target) => Object.fromEntries(releaseEvidenceKeys(target).map((key) => [key, true]))

test('web release is ready only with all web evidence', () => {
  const evidence = complete('web')
  assert.deepEqual(evaluateReleaseReadiness(evidence), { target: 'web', status: 'READY', missing: [], evidence })
})

test('android additionally requires signed package and real-device evidence', () => {
  const webEvidence = complete('web')
  const blocked = evaluateReleaseReadiness(webEvidence, { target: 'android' })
  assert.equal(blocked.status, 'BLOCKED')
  assert.deepEqual(blocked.missing, ['signedPackage', 'realDevice'])

  const evidence = { ...webEvidence, signedPackage: true, realDevice: true }
  assert.equal(evaluateReleaseReadiness(evidence, { target: 'android' }).status, 'READY')
})

test('repository keeps automated device acceptance and physical checklist', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  assert.equal(pkg.scripts['test:device'], 'node test/device-acceptance.mjs')
  assert.ok(fs.existsSync('docs/DEVICE_ACCEPTANCE.md'))
})
