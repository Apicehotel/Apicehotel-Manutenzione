import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { evaluateReleaseReadiness, RELEASE_EVIDENCE_KEYS } from '../src/release/release-readiness.js';

test('release gate is READY only with every evidence item', () => {
  const evidence = Object.fromEntries(RELEASE_EVIDENCE_KEYS.map((key) => [key, true]));
  assert.deepEqual(evaluateReleaseReadiness(evidence), { status: 'READY', missing: [], evidence });
});

test('release gate reports deterministic blockers', () => {
  const result = evaluateReleaseReadiness({ quality: true, build: true });
  assert.equal(result.status, 'BLOCKED');
  assert.deepEqual(result.missing, ['audit', 'e2e', 'device', 'rollback', 'environmentSeparation', 'humanReview']);
});

test('repository exposes the group-three contracts', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['test:e2e'], 'node test/e2e.mjs');
  assert.equal(pkg.scripts['test:device'], 'node test/device-acceptance.mjs');
  assert.equal(JSON.parse(fs.readFileSync('vercel.json', 'utf8')).git.deploymentEnabled, false);
  assert.match(fs.readFileSync('.github/workflows/digitalocean-preview.yml', 'utf8'), /environment: preview/);
  assert.ok(fs.existsSync('docs/DEVICE_ACCEPTANCE.md'));
});
