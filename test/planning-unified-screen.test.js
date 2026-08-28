import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const hub=fs.readFileSync(new URL('../src/randapp/PlanningHub.jsx',import.meta.url),'utf8')

test('planning work and sale share one operational screen',()=>{
  assert.match(hub,/Lavori e sale in un’unica schermata operativa/)
  assert.match(hub,/<PlanningWorkSimple/)
  assert.match(hub,/<PlanningSaleSimple/)
  assert.doesNotMatch(hub,/setSection/)
  assert.doesNotMatch(hub,/PlanningChoice/)
})

test('unified planning still follows independent permissions',()=>{
  assert.match(hub,/canUser\(user,'planning_work','view'\)/)
  assert.match(hub,/canUser\(user,'planning_sale','view'\)/)
})
