import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { RANDAPP_FREEZE, evaluateFrozenChange } from '../src/release/freeze-policy.js'

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')

test('freeze allows maintenance changes only with human review',()=>{
  for(const changeType of RANDAPP_FREEZE.allowedChangeTypes){
    assert.equal(evaluateFrozenChange({changeType,humanReview:true}).allowed,true)
    assert.equal(evaluateFrozenChange({changeType,humanReview:false}).allowed,false)
  }
})

test('feature and architecture changes stay frozen without explicit exception evidence',()=>{
  for(const changeType of ['feature','architecture','schema','dependency-major']){
    assert.equal(evaluateFrozenChange({changeType,humanReview:true}).allowed,false)
    assert.equal(evaluateFrozenChange({
      changeType,
      humanReview:true,
      exceptionApproved:true,
      rollbackPlan:true,
      releaseGatePassed:true,
    }).allowed,true)
  }
})

test('direct main changes are forbidden even for maintenance',()=>{
  assert.deepEqual(
    evaluateFrozenChange({changeType:'bugfix',humanReview:true,directMain:true}),
    {allowed:false,code:'DIRECT_MAIN_FORBIDDEN'},
  )
})

test('repository exposes web release and final freeze gates in canonical CI',()=>{
  const ci=read('.github/workflows/ci.yml')
  const pkg=JSON.parse(read('package.json'))
  assert.equal(pkg.scripts['release:check'],'node scripts/check-release-readiness.mjs --target=web')
  assert.equal(pkg.scripts['freeze:check'],'node scripts/check-final-freeze.mjs')
  assert.match(ci,/name: Web Release Readiness gate[\s\S]*run: npm run release:check/)
  assert.match(ci,/name: Final Freeze gate[\s\S]*run: npm run freeze:check/)
  assert.ok(ci.indexOf('Web Release Readiness gate') < ci.indexOf('Final Freeze gate'))
})

test('final freeze preserves environment separation and anti-zombie invariants',()=>{
  const vercel=JSON.parse(read('vercel.json'))
  const ocean=read('.github/workflows/digitalocean-preview.yml')
  const main=read('src/main.jsx')
  assert.equal(vercel.git?.deploymentEnabled,false)
  assert.match(ocean,/environment: preview/)
  assert.doesNotMatch(ocean,/environment: production/)
  assert.doesNotMatch(main,/ui-v2-preview|randui-v2\/Preview/)
})
