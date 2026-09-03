import test from 'node:test'
import assert from 'node:assert/strict'
import { RuntimeCapabilityFuse, RuntimeFuseState } from '../src/reliability/runtime-fuse.js'
import { createConfigSnapshot, evaluateConfigDrift, assertNoConfigDrift } from '../src/reliability/drift-guard.js'
import { evaluateSloWindow, assertSloBudget } from '../src/reliability/slo-budget.js'
import { createReleaseAttestation, verifyReleaseAttestation } from '../src/reliability/release-attestation.js'

test('47 runtime fuse is hotel/module scoped and reset requires authorization', () => {
  const fuse = new RuntimeCapabilityFuse({ fuseId:'f1', hotelIds:['gio'], module:'maintenance', capability:'write' })
  assert.equal(fuse.evaluate({hotelId:'gio',module:'maintenance',capability:'write'}).allowed,true)
  fuse.trip('INCIDENT')
  assert.equal(fuse.snapshot().state,RuntimeFuseState.TRIPPED)
  assert.equal(fuse.evaluate({hotelId:'gio',module:'maintenance',capability:'write'}).allowed,false)
  assert.equal(fuse.evaluate({hotelId:'choco',module:'maintenance',capability:'write'}).allowed,true)
  assert.throws(()=>fuse.reset(),/RUNTIME_FUSE_RESET_NOT_AUTHORIZED/)
  fuse.reset({authorized:true})
  assert.equal(fuse.evaluate({hotelId:'gio',module:'maintenance',capability:'write'}).allowed,true)
})

test('48 drift guard is deterministic and fails closed on config/version drift', () => {
  const a=createConfigSnapshot({hotelId:'gio',module:'randai',version:'1',policy:{b:2,a:1},config:{x:true}})
  const b=createConfigSnapshot({hotelId:'gio',module:'randai',version:'1',policy:{a:1,b:2},config:{x:true}})
  assert.equal(a.fingerprint,b.fingerprint)
  assert.equal(evaluateConfigDrift({expected:a,actual:b}).ok,true)
  const changed=createConfigSnapshot({hotelId:'gio',module:'randai',version:'1',policy:{a:1,b:3},config:{x:true}})
  assert.equal(evaluateConfigDrift({expected:a,actual:changed}).ok,false)
  assert.throws(()=>assertNoConfigDrift({expected:a,actual:changed}),/DRIFT_FINGERPRINT_MISMATCH/)
})

test('49 SLO budget computes burn rate and blocks exhausted windows', () => {
  const healthy=evaluateSloWindow({totalEvents:10000,badEvents:20,target:0.995,maxBurnRate:1})
  assert.equal(healthy.ok,true)
  const burned=evaluateSloWindow({totalEvents:10000,badEvents:80,target:0.995,maxBurnRate:1})
  assert.equal(burned.ok,false)
  assert.throws(()=>assertSloBudget({totalEvents:10000,badEvents:80,target:0.995,maxBurnRate:1}),/SLO_ERROR_BUDGET_EXHAUSTED/)
})

test('50 release attestation binds green checks to commit and config fingerprint', () => {
  const checks={security:true,quality:true,critical:true,multihotel:true,production:true,build:true,contracts:true,browser:true,device:true}
  const att=createReleaseAttestation({releaseId:'r1',commitSha:'abc123',configFingerprint:'cfg-123',checks,evidence:['ci:1381']})
  assert.equal(verifyReleaseAttestation(att,{commitSha:'abc123',configFingerprint:'cfg-123'}).ok,true)
  assert.equal(verifyReleaseAttestation(att,{commitSha:'other',configFingerprint:'cfg-123'}).code,'ATTESTATION_COMMIT_MISMATCH')
  assert.equal(verifyReleaseAttestation(att,{commitSha:'abc123',configFingerprint:'cfg-other'}).code,'ATTESTATION_CONFIG_MISMATCH')
})
