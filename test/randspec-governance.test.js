import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (path) => readFileSync(path, 'utf8');

test('Rand Constitution preserves freeze, canonical ownership and human release authority', () => {
  const constitution = read('docs/governance/RAND_CONSTITUTION.md');
  assert.match(constitution, /nessun agente autonomo può fare push, merge o deploy diretto su `main`/i);
  assert.match(constitution, /Un proprietario canonico per capacità/i);
  assert.match(constitution, /Human-in-the-loop per rischio/i);
  assert.match(constitution, /Change protocol/i);
});

test('RandSpec extends RandFlow instead of creating another lifecycle', () => {
  const doc = read('docs/architecture/RANDSPEC_V1.md');
  const flow = read('docs/architecture/RAND_OPENAI_PLUGINS_ADOPTION_V1.md');
  assert.match(doc, /estende RandFlow/i);
  assert.match(doc, /Spec Kit.*SOURCE_ONLY/i);
  assert.match(flow, /RandFlow v1/);
});

test('RandSpec templates cover intent, plan, tasks, changes and convergence', () => {
  assert.match(read('specs/_template/spec.md'), /## Acceptance criteria/);
  assert.match(read('specs/_template/plan.md'), /## RandRadar decision/);
  assert.match(read('specs/_template/tasks.md'), /## Converge checklist/);
  assert.match(read('specs/_template/change-log.md'), /## Changes/);
});

test('RandSpec validator accepts repository specs', () => {
  const result = spawnSync(process.execPath, ['scripts/validate-randspec.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /RandSpec validation OK/);
});

test('canonical CI validates RandSpec before quality/build gates', () => {
  const ci = read('.github/workflows/ci.yml');
  const spec = ci.indexOf('Validate RandSpec');
  const quality = ci.indexOf('Quality matrix');
  assert.ok(spec >= 0, 'CI must contain Validate RandSpec');
  assert.ok(quality > spec, 'RandSpec validation must run before Quality matrix');
});
