import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const workflow = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')

function topLevelTriggerBlock(name) {
  const lines = workflow.split(/\r?\n/)
  const triggerLine = lines.findIndex((line) => line === `  ${name}:`)
  assert.notEqual(triggerLine, -1, `CI must declare ${name}`)
  const body = []
  for (let i = triggerLine + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^  [A-Za-z_][A-Za-z0-9_-]*:\s*$/.test(line)) break
    body.push(line)
  }
  return body.join('\n')
}

test('RandFlow CI validates every pull request including stacked PRs', () => {
  const pullRequest = topLevelTriggerBlock('pull_request')
  assert.doesNotMatch(pullRequest, /^\s+branches:/m, 'pull_request must not be restricted by base branch')
  assert.match(workflow, /^  workflow_dispatch:\s*$/m)
})

test('push CI remains bounded while PR CI stays universal', () => {
  const push = topLevelTriggerBlock('push')
  assert.match(push, /^\s+branches:/m)
  assert.match(push, /^\s+- main\s*$/m)
})
