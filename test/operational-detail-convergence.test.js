import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildUrgentTaskTimeline, buildReminderTaskTimeline, buildSupplyTimeline } from '../src/randapp/task-supply-timeline.js'
const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const urgent=read('src/randapp/operations/UrgentView.jsx'),reminders=read('src/randapp/reminders/RemindersView.jsx'),supply=read('src/randapp/SupplyRequestsPortal.jsx'),shell=read('src/randapp/Shell.jsx'),taskDetail=read('src/randapp/TaskResourceDetail.jsx'),supplyDetail=read('src/randapp/SupplyRequestDetail.jsx')
test('urgent timeline uses persisted take and completion evidence',()=>{const e=buildUrgentTaskTimeline({status:'completata',createdAt:1,takenBy:'A',takenAt:2,completedBy:'B',completedAt:3});assert.deepEqual(e.map(x=>x.id),['created','taken','completed']);assert.equal(e[2].at,3)})
test('reminder timeline keeps active state as current',()=>{const e=buildReminderTaskTimeline({active:true,created_at:'2026-09-24T08:00:00Z',times:['09:00']});assert.equal(e.at(-1).title,'Attivo');assert.equal(e.at(-1).current,true)})
test('supply timeline uses real item resolution timestamps',()=>{const e=buildSupplyTimeline({created_at:'2026-09-24T08:00:00Z',supply_request_items:[{id:'1',product_name:'Acqua',status:'delivered',resolved_at:'2026-09-24T08:10:00Z'}]});assert.ok(e.some(x=>x.title==='Prodotto consegnato'))})
test('task resources and supplies use canonical focus detail',()=>{assert.match(taskDetail,/kind="task"/);assert.match(taskDetail,/OperationalTimeline/);assert.match(supplyDetail,/kind="supply"/);assert.match(supplyDetail,/OperationalTimeline/);assert.match(urgent,/TaskResourceDetail/);assert.match(reminders,/TaskResourceDetail/);assert.match(supply,/SupplyRequestDetail/)})
test('list-level duplicate operational actions are removed',()=>{assert.doesNotMatch(urgent,/>Prendi in carico<\/Button>/);assert.doesNotMatch(urgent,/>Completa<\/Button>/);assert.doesNotMatch(reminders,/window\.confirm/);assert.doesNotMatch(supply,/onClick=\{\(\) => onResolve\(item\.id/)})
test('Shell enters Focus Mode for urgent reminder and supply details',()=>{assert.equal((shell.match(/onDetailChange=\{handleOperationalDetailChange\}/g)||[]).length,5)})
