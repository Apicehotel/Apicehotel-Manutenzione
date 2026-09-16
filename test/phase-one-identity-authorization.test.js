import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DurableStatus, RandDurableRuntime } from '../src/randai/core/durable-runtime.js'

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

test('Phase 1 PIN authentication is hash-only and fails closed',()=>{
  const source=read('supabase/functions/pin-auth/index.ts')
  assert.match(source,/bcrypt\.compare\(pin,credential\.pin_hash\)/)
  assert.doesNotMatch(source,/ruolo,pin,hotels/)
  assert.doesNotMatch(source,/legacy\.pin/)
  assert.match(source,/CREDENTIAL_REQUIRED/)
})

test('Phase 1 makes RandGuide an explicit central permission',()=>{
  const client=read('src/permissions.js')
  const migration=read('supabase/migrations/20260915053605_phase1_identity_authorization.sql')
  const manual=read('src/randapp/operations/UtilityLightViews.jsx')
  assert.match(client,/['"]procedures['"]/)
  assert.match(migration,/has_app_permission\(hotel_id,'procedures','view'\)/)
  assert.match(migration,/status='approved'/)
  assert.match(migration,/on conflict \(role,module,action\) do update/i)
  assert.match(migration,/randguide_procedure_versions\.hotel_id/)
  assert.match(migration,/randguide_links\.from_type='procedure'/)
  assert.match(migration,/randguide_links\.to_type='procedure'/)
  assert.match(manual,/canUser\(user,'procedures','view'\)/)
  assert.match(manual,/\.eq\('status','approved'\)/)
})

test('Phase 1 bounds a cooperative non-responsive durable workflow',async()=>{
  const runtime=new RandDurableRuntime({executionTimeoutMs:15,abortGraceMs:25})
  const result=await runtime.start({
    workflow:{id:'never',execute:async({signal})=>new Promise((resolve)=>signal.addEventListener('abort',resolve,{once:true}))},
    context:{actor:{id:'u1'},hotelId:'hotelgio',grantedScopes:['workflow:execute']},
    idempotencyKey:'phase1-timeout',
  })
  assert.equal(result.status,DurableStatus.FAILED)
  assert.equal(result.errorCode,'WORKFLOW_EXECUTION_TIMEOUT')
})

test('Phase 1 fails closed when a workflow ignores abort',async()=>{
  const runtime=new RandDurableRuntime({executionTimeoutMs:10,abortGraceMs:5})
  const result=await runtime.start({
    workflow:{id:'ignores-abort',execute:async()=>new Promise(()=>{})},
    context:{actor:{id:'u1'},hotelId:'hotelgio',grantedScopes:['workflow:execute']},
    idempotencyKey:'phase1-unconfirmed-abort',
  })
  assert.equal(result.status,DurableStatus.WAITING)
  assert.equal(result.errorCode,'WORKFLOW_ABORT_UNCONFIRMED')
  const resumed=await runtime.resume({
    runId:result.id,
    workflow:{id:'ignores-abort',execute:async()=>({output:'must-not-run'})},
    context:{actor:{id:'u1'},hotelId:'hotelgio',grantedScopes:['workflow:execute']},
  })
  assert.equal(resumed.status,DurableStatus.WAITING)
  assert.equal(resumed.errorCode,'WORKFLOW_ABORT_UNCONFIRMED')
})

test('Phase 1 execution lease expires before post-timeout mutation',async()=>{
  let mutationBlocked=false
  const runtime=new RandDurableRuntime({executionTimeoutMs:10,abortGraceMs:25})
  const result=await runtime.start({
    workflow:{id:'guarded-mutation',execute:async({signal,assertExecutionActive})=>new Promise((resolve)=>signal.addEventListener('abort',()=>{
      try{assertExecutionActive()}catch(error){mutationBlocked=error.code==='WORKFLOW_EXECUTION_EXPIRED'}
      resolve()
    },{once:true}))},
    context:{actor:{id:'u1'},hotelId:'hotelgio',grantedScopes:['workflow:execute']},
    idempotencyKey:'phase1-expired-lease',
  })
  assert.equal(result.status,DurableStatus.FAILED)
  assert.equal(result.errorCode,'WORKFLOW_EXECUTION_TIMEOUT')
  assert.equal(mutationBlocked,true)
})
