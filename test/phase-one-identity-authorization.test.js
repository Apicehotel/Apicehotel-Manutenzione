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
  assert.match(manual,/canUser\(user,'procedures','view'\)/)
  assert.match(manual,/\.eq\('status','approved'\)/)
})

test('Phase 1 bounds a non-responsive durable workflow',async()=>{
  const runtime=new RandDurableRuntime({executionTimeoutMs:15})
  const result=await runtime.start({
    workflow:{id:'never',execute:async({signal})=>new Promise((resolve)=>signal.addEventListener('abort',resolve,{once:true}))},
    context:{actor:{id:'u1'},hotelId:'hotelgio',grantedScopes:['workflow:execute']},
    idempotencyKey:'phase1-timeout',
  })
  assert.equal(result.status,DurableStatus.FAILED)
  assert.equal(result.errorCode,'WORKFLOW_EXECUTION_TIMEOUT')
})
