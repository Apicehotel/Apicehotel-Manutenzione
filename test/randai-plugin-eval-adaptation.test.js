import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

const policy = JSON.parse(read('../evals/randai/plugin-eval-policy.json'))
const script = read('../scripts/rand-plugin-eval.mjs')
const pkg = JSON.parse(read('../package.json'))
const workflow = read('../.github/workflows/randai-group1-security.yml')

test('plugin-eval is adapted as a pattern while Promptfoo remains canonical', () => {
  assert.equal(policy.engine, 'Promptfoo')
  assert.equal(policy.mode, 'ADAPT_PATTERN')
  assert.equal(policy.promotion.allowAutomaticProductionPromotion, false)
  assert.equal(policy.promotion.requireHumanReview, true)
  assert.match(pkg.scripts['eval:randai:security'], /promptfoo@0\.122\.2/)
  assert.doesNotMatch(JSON.stringify(pkg), /plugin-eval(?:@|\s|$)/)
})

test('governed evaluation has Fix First, before/after comparison and evidence', () => {
  for (const dimension of ['security','hotelIsolation','permissions','correctness','regression','cost','maintainability','rollback']) {
    assert.ok(policy.requiredDimensions.includes(dimension), `${dimension} missing`)
  }
  assert.deepEqual(policy.fixFirstOrder.slice(0, 3), ['security','hotelIsolation','permissions'])
  assert.match(script, /fixFirst/)
  assert.match(script, /function compare\(\)/)
  assert.match(script, /criticalFindingsDelta/)
  assert.match(script, /promotionReady/)
  assert.ok(policy.evidence.includes('evals/randai/promptfooconfig.yaml'))
  assert.ok(policy.evidence.includes('test/quality-matrix.json'))
})

test('Group 1 preserves evidence without turning superseded cancellations red', () => {
  assert.match(workflow, /Governed plugin evaluation report[\s\S]*if: \$\{\{ !cancelled\(\) \}\}/)
  assert.match(workflow, /Upload governed evaluation evidence[\s\S]*if: \$\{\{ !cancelled\(\) \}\}/)
  assert.match(workflow, /retention-days: 14/)
  assert.match(workflow, /if-no-files-found: error/)
  assert.doesNotMatch(workflow, /Upload governed evaluation evidence[\s\S]*if: always\(\)/)
})
