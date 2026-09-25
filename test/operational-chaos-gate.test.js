import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createOperationalActionGate, operationalErrorMessage } from '../src/randapp/operational-action-guard.js'

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')

test('single-flight gate drops a concurrent duplicate without executing it', async()=>{
  const gate=createOperationalActionGate()
  let release
  let executions=0
  const first=gate.run(async()=>{executions+=1;await new Promise(resolve=>{release=resolve});return 'ok'})
  const duplicate=await gate.run(async()=>{executions+=1;return 'duplicate'})
  assert.equal(duplicate.ignored,true)
  assert.equal(duplicate.reason,'BUSY')
  assert.equal(executions,1)
  release()
  const result=await first
  assert.equal(result.ok,true)
  assert.equal(gate.busy,false)
})

test('failed mutation unlocks the gate and a retry can succeed', async()=>{
  const gate=createOperationalActionGate()
  const failed=await gate.run(async()=>{throw new Error('rete assente')})
  assert.equal(failed.ok,false)
  assert.equal(operationalErrorMessage(failed.error),'rete assente')
  assert.equal(gate.busy,false)
  const retry=await gate.run(async()=>42)
  assert.deepEqual(retry,{ok:true,value:42})
})

test('missing action fails closed without taking the lock', async()=>{
  const gate=createOperationalActionGate()
  const result=await gate.run(null)
  assert.equal(result.ignored,true)
  assert.equal(result.reason,'NO_ACTION')
  assert.equal(gate.busy,false)
})

test('all operational domains share the action guard and inline error contract',()=>{
  const issue=read('src/randapp/Issues.jsx')
  const issueDetail=issue.slice(issue.indexOf('function IssueDetail'),issue.indexOf('const FILTERS'))
  const intervention=read('src/randapp/operations/InterventionsView.jsx')
  const task=read('src/randapp/TaskResourceDetail.jsx')
  const supply=read('src/randapp/SupplyRequestDetail.jsx')
  for(const source of [issueDetail,intervention,task,supply]){
    assert.match(source,/useOperationalActionGuard/)
    assert.match(source,/operational-action-error/)
  }
  assert.match(issueDetail,/const closeAfter = \(action\) => runAction/)
  assert.doesNotMatch(issueDetail,/const complete = \(\) => \{ onUpdate/)
  assert.doesNotMatch(issueDetail,/const pieceArrived = \(\) => \{ onUpdate/)
  assert.doesNotMatch(issueDetail,/const techDone = \(\) => \{ onUpdate/)
  assert.match(intervention,/onSuccess:onClose/)
  assert.match(task,/onSuccess: onBack/)
  assert.match(supply,/onStart: \(\) => setBusyId\(itemId\)/)
})

test('domain parents propagate failures back into Focus Mode',()=>{
  const reminders=read('src/randapp/reminders/RemindersView.jsx')
  const supplyPortal=read('src/randapp/SupplyRequestsPortal.jsx')
  assert.match(reminders,/throw e instanceof Error\?e:new Error\(message\)/)
  assert.match(supplyPortal,/throw err instanceof Error \? err : new Error\(message\)/)
})

test('CI exposes a named operational chaos gate before browser E2E',()=>{
  const ci=read('.github/workflows/ci.yml')
  const pkg=JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['test:chaos'],'node --test test/operational-chaos-gate.test.js')
  assert.match(ci,/name: Operational chaos gate[\s\S]*run: npm run test:chaos/)
  assert.ok(ci.indexOf('Operational chaos gate') < ci.indexOf('Cross-platform browser gate'))
})

test('offline reconnect and viewport chaos remain covered by the existing device gates',()=>{
  const device=read('test/device-acceptance.mjs')
  const resilience=read('test/point6-resilience.test.js')
  assert.match(device,/context\.setOffline\(true\)/)
  assert.match(device,/context\.setOffline\(false\)/)
  assert.match(device,/setViewportSize/)
  assert.match(resilience,/stale sessions are revalidated on startup and reconnect/)
  assert.match(resilience,/bounded jittered backoff, leases, permanent-failure quarantine and conflict protection/)
})
