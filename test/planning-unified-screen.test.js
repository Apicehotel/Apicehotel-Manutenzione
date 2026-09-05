import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const hub=fs.readFileSync(new URL('../src/randapp/PlanningHub.jsx',import.meta.url),'utf8')

test('planning opens on compact work and sale preview',()=>{
  assert.match(hub,/Lavori, sale e attività di oggi/)
  assert.match(hub,/PlanningChoice/)
  assert.match(hub,/title="Planning lavori"/)
  assert.match(hub,/title="Planning sale"/)
  assert.match(hub,/setSection\('work'\)/)
  assert.match(hub,/setSection\('sale'\)/)
  assert.match(hub,/‹ Riepilogo/)
})

test('planning details open only after selection',()=>{
  assert.match(hub,/section==='work'/)
  assert.match(hub,/<PlanningWorkSimple/)
  assert.match(hub,/section==='sale'/)
  assert.match(hub,/<PlanningSaleSimple/)
})

test('planning preview follows independent permissions',()=>{
  assert.match(hub,/canUser\(user,'planning_work','view'\)/)
  assert.match(hub,/canUser\(user,'planning_sale','view'\)/)
})
