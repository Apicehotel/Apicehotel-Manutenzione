import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const readWorkflow = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const canonicalCi = readWorkflow('../.github/workflows/ci.yml')
const group1Security = readWorkflow('../.github/workflows/randai-group1-security.yml')

function topLevelTriggerBlock(workflow, name, label) {
  const lines = workflow.split(/\r?\n/)
  const triggerLine = lines.findIndex((line) => line === `  ${name}:`)
  assert.notEqual(triggerLine, -1, `${label} must declare ${name}`)
  const body = []
  for (let i = triggerLine + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line)) break
    body.push(line)
  }
  return body.join('\n')
}

function assertUniversalPullRequest(workflow, label) {
  const pullRequest = topLevelTriggerBlock(workflow, 'pull_request', label)
  assert.doesNotMatch(pullRequest, /^\s+branches:/m, `${label} pull_request must not be restricted by base branch`)
  assert.match(workflow, /^  workflow_dispatch:\s*$/m)
}

test('RandFlow canonical CI validates every pull request including stacked PRs', () => {
  assertUniversalPullRequest(canonicalCi, 'canonical CI')
})

test('RandAI security evaluation also validates stacked pull requests', () => {
  assertUniversalPullRequest(group1Security, 'RandAI Group 1 Security')
  assert.match(group1Security, /npm run test:group1/)
  assert.match(group1Security, /npm run eval:randai:security/)
})

test('push CI remains bounded while PR CI stays universal', () => {
  const push = topLevelTriggerBlock(canonicalCi, 'push', 'canonical CI')
  assert.match(push, /^\s+branches:/m)
  assert.match(push, /^\s+- main\s*$/m)
})
