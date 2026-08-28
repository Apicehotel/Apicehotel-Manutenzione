import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const planned=fs.readFileSync(new URL('../src/planned-data.js',import.meta.url),'utf8')
const dispatcher=fs.readFileSync(new URL('../supabase/functions/assignment-notify/index.ts',import.meta.url),'utf8')
const ntfyConfig=fs.readFileSync(new URL('../supabase/functions/ntfy-config/index.ts',import.meta.url),'utf8')
const ntfyAlert=fs.readFileSync(new URL('../supabase/functions/ntfy-alert/index.ts',import.meta.url),'utf8')

test('interventions notify only newly added assignees',()=>{
  assert.match(planned,/notifyNewAssignees/)
  assert.match(planned,/previous=new Set\(assigneeIds\(previousAssignees\)\)/)
  assert.match(planned,/filter\(\(id\)=>!previous\.has\(id\)\)/)
  assert.match(planned,/functions\.invoke\('assignment-notify'/)
  assert.match(planned,/sectionOf\(item\)!==SECTION_INTERVENTION/)
  assert.match(planned,/await notifyNewAssignees\(created\)/)
  assert.match(planned,/await notifyNewAssignees\(updated,currentApp\?\.assignees\|\|\[\]\)/)
})

test('assignment dispatcher targets selected users and requires assign permission',()=>{
  assert.match(dispatcher,/role_permissions/)
  assert.match(dispatcher,/\.eq\("module","interventions"\)\.eq\("action","assign"\)/)
  assert.match(dispatcher,/if\(!assignPermission\?\.allowed\)return json\(\{ok:false,error:"forbidden"\},403\)/)
  assert.match(dispatcher,/push_subscriptions/)
  assert.match(dispatcher,/\.in\("utente",recipientIds\)/)
  assert.match(dispatcher,/personalTopic\(hotelId,rid\)/)
  assert.match(dispatcher,/channel:"push"/)
  assert.match(dispatcher,/channel:"ntfy"/)
  assert.match(dispatcher,/event_type:"assignment"/)
  assert.match(dispatcher,/intervention_id:interventionId/)
  assert.match(dispatcher,/requested\.filter\(id=>assigned\.includes\(id\)\)/)
})

test('ntfy exposes and tests one private assignment channel per user',()=>{
  assert.match(ntfyConfig,/id:"assignments"/)
  assert.match(ntfyConfig,/Interventi assegnati a te/)
  assert.match(ntfyConfig,/personalTopic\(hotelId,userData\.user\.id\)/)
  assert.match(ntfyAlert,/channel==="assignments"/)
  assert.match(ntfyAlert,/TEST Interventi/)
  assert.match(ntfyAlert,/priority:assignments\?4:5/)
})

test('notification failure never rolls back the saved intervention',()=>{
  assert.match(planned,/catch\(error\)\{console\.warn\('Notifica assegnazione non consegnata'/)
})
