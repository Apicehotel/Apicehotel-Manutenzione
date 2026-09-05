import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { inferIssueOperationalContext, issueOperationalContextLabel } from '../src/issue-operational-context.js'

const catalog={
  roomGroups:[
    {name:'Jazz P1',rooms:['1101','1114']},
    {name:'Wine P2',rooms:['201','214']},
  ],
  zones:[{name:'Hall',aliases:['hall']}],
}

test('camera Giò manuale eredita area e piano dal catalogo',()=>{
  const context=inferIssueOperationalContext({hotelId:'hotelgio',catalog,mode:'camera',location:'214'})
  assert.deepEqual(context,{
    locationMode:'camera',roomNumber:'214',areaCode:'wine',areaLabel:'Wine',floorNumber:2,floorLabel:'Piano 2',sourceModule:null,sourceRef:null,
  })
  assert.equal(issueOperationalContextLabel(context),'Wine · Piano 2 · Camera 214')
})

test('prefill Housekeeping resta la fonte canonica del contesto',()=>{
  const context=inferIssueOperationalContext({
    hotelId:'hotelgio',catalog,mode:'camera',location:'214',
    prefill:{location:'214',areaCode:'wine',areaLabel:'Wine',floorNumber:3,floorLabel:'Piano 3',sourceModule:'housekeeping',sourceRef:'housekeeping:hotelgio:2026-09-05:214'},
  })
  assert.equal(context.floorNumber,3)
  assert.equal(context.floorLabel,'Piano 3')
  assert.equal(context.sourceModule,'housekeeping')
  assert.equal(context.sourceRef,'housekeeping:hotelgio:2026-09-05:214')
})

test('piano nullo non diventa Piano 0',()=>{
  const context=inferIssueOperationalContext({hotelId:'brigantino',catalog:{roomGroups:[]},mode:'camera',location:'12',prefill:{location:'12',floorNumber:null,sourceModule:'housekeeping'}})
  assert.equal(context.floorNumber,null)
  assert.equal(context.floorLabel,null)
})

test('zona manuale non richiede area o piano',()=>{
  const context=inferIssueOperationalContext({hotelId:'hotelgio',catalog,mode:'zona',location:'Hall'})
  assert.equal(context.locationMode,'zona')
  assert.equal(context.roomNumber,null)
  assert.equal(context.areaCode,null)
  assert.equal(context.floorNumber,null)
})

test('contratto dati e UI collega Housekeeping alle segnalazioni canoniche',()=>{
  const issuesData=fs.readFileSync(new URL('../src/issues-data.js',import.meta.url),'utf8')
  const housekeeping=fs.readFileSync(new URL('../src/housekeeping-v2.jsx',import.meta.url),'utf8')
  const shell=fs.readFileSync(new URL('../src/randapp/Shell.jsx',import.meta.url),'utf8')
  const issues=fs.readFileSync(new URL('../src/randapp/Issues.jsx',import.meta.url),'utf8')
  assert.match(issuesData,/from\('segnalazioni'\)/)
  assert.match(issuesData,/set\('area_code',issue\.areaCode\)/)
  assert.match(issuesData,/set\('floor_number',issue\.floorNumber\)/)
  assert.match(issuesData,/set\('source_module',issue\.sourceModule\)/)
  assert.match(housekeeping,/fetchOperationalFloorContexts/)
  assert.match(housekeeping,/saveOperationalFloorContext/)
  assert.match(housekeeping,/data-testid="housekeeping-report-issue"/)
  assert.match(housekeeping,/sourceModule:'housekeeping'/)
  assert.match(shell,/canUser\(user,'issues','create'\)/)
  assert.match(shell,/requestHousekeepingIssue/)
  assert.match(issues,/data-testid="issue-housekeeping-context"/)
  assert.match(issues,/origin: sourceModule === 'housekeeping' \? 'Housekeeping' : 'App'/)
})

test('migrazione mantiene compatibilita storica e zone senza piano',()=>{
  const migration=fs.readFileSync(new URL('../supabase/migrations/20260905054000_issue_operational_context.sql',import.meta.url),'utf8')
  for(const column of ['location_mode','room_number','area_code','area_label','floor_number','floor_label','source_module','source_ref'])assert.match(migration,new RegExp(`add column if not exists ${column}`))
  assert.doesNotMatch(migration,/add column if not exists (?:area_code|floor_number)[^,;]*not null/i)
  assert.match(migration,/where location_mode is null/)
  assert.match(migration,/segnalazioni_hotel_floor_open_idx/)
})

test('policy update mantiene i permessi e inizializza auth uid una sola volta',()=>{
  const migration=fs.readFileSync(new URL('../supabase/migrations/20260905060000_optimize_issue_update_policy.sql',import.meta.url),'utf8')
  for(const action of ['edit','take_charge','complete','assign'])assert.match(migration,new RegExp(`has_app_permission\\(hotel_id,'issues','${action}'\\)`))
  assert.match(migration,/created_by_user_id = \(select auth\.uid\(\)\)/)
  assert.match(migration,/has_hotel_role\(hotel_id,array\['Supremo'\]\)/)
  assert.match(migration,/with check/)
})
