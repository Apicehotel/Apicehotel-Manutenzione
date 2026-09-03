import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { canonicalizeProcedure, isProcedurePublishable, composeProcedureDraft, approveProcedureDraft, dedupeKnowledgeSources, buildRandGuideGraph, findConnectedKnowledge, evaluateRandGuideReadiness, GuidedProcedureEngine, GuidanceStore, StepResult } from '../src/randai/guidance/index.js'
import { getRandEcosystemManifest, EcosystemStatus } from '../src/randai/core/ecosystem.js'

const HOTEL = 'hotelgio'
const procedure = (overrides={}) => ({ id:'proc-1', hotelId:HOTEL, title:'Reset pompa', summary:'Procedura verificata', steps:[{id:'s1',title:'Controlla alimentazione',next:{DONE:'s2'}},{id:'s2',title:'Verifica ripartenza',next:{}}], status:'approved', sourceConfidence:100, version:2, ...overrides })

test('74 canonical catalog is hotel-scoped and publishable only with evidence', () => {
  const p = canonicalizeProcedure(procedure())
  assert.equal(p.hotelId, HOTEL)
  assert.equal(isProcedurePublishable(p).publishable, true)
  assert.deepEqual(isProcedurePublishable(procedure({ riskLevel:'critical', caution:null })).blockers, ['CRITICAL_WITHOUT_CAUTION'])
})

test('75 assisted authoring never auto-publishes model output', async () => {
  const result = await composeProcedureDraft({ rawText:'Pompa bloccata\nControllare quadro\nRiarmare solo se sicuro', context:{ hotelId:HOTEL }, modelAdapter:async ({draft}) => ({ procedure:{ ...draft, title:'Pompa bloccata', status:'approved' }, notes:['strutturata'] }) })
  assert.equal(result.assisted, true)
  assert.equal(result.requiresApproval, true)
  assert.equal(result.draft.status, 'draft')
  const approved = approveProcedureDraft(result.draft, { approvedBy:'user-1', now:'2026-09-03T20:00:00.000Z' })
  assert.equal(approved.status, 'approved')
})

test('76 ingestion deduplicates same scoped source while preserving provenance', () => {
  const input={hotelId:HOTEL,title:'Manuale pompa',sourceType:'manuale_costruttore',externalUrl:'https://drive.google.com/a',confidence:95}
  const result=dedupeKnowledgeSources([input,input,{...input,hotelId:'chocohotel'}])
  assert.equal(result.accepted.length,2)
  assert.equal(result.duplicates.length,1)
  assert.equal(result.accepted[0].provenance.confidence,95)
})

test('77 guided runtime branches and completes without leaving hotel scope', async () => {
  const engine=new GuidedProcedureEngine({store:new GuidanceStore()})
  const session=await engine.start({procedure:procedure({steps:[{id:'s1',title:'Primo',next:{DONE:'s2'}},{id:'s2',title:'Secondo',next:{}}]}),actorRole:'manutentore'})
  await engine.answer(session.id,StepResult.DONE,{hotelId:HOTEL})
  const done=await engine.answer(session.id,StepResult.DONE,{hotelId:HOTEL})
  assert.equal(done.status,'COMPLETED')
  await assert.rejects(()=>engine.current(session.id,{hotelId:'chocohotel'}),/requested scope/)
})

test('78 graph connects equipment, locations, procedures and documents only inside hotel', () => {
  const graph=buildRandGuideGraph({hotelId:HOTEL,procedures:[{...procedure(),hotel_id:HOTEL,equipment_ids:['pump-1']}],equipment:[{id:'pump-1',hotel_id:HOTEL,name:'Pompa 1',category:'pompa',location:'Centrale termica'},{id:'foreign',hotel_id:'chocohotel',name:'No',location:'No'}],documents:[{id:'doc-1',hotel_id:HOTEL,title:'Manuale',procedure_id:'proc-1',equipment_id:'pump-1',status:'approved'}]})
  assert.equal(graph.nodes.some((node)=>node.id==='foreign'),false)
  const connected=findConnectedKnowledge(graph,{type:'equipment',id:'pump-1',maxDepth:2})
  assert.ok(connected.nodeKeys.includes('procedure:proc-1'))
  assert.ok(connected.nodeKeys.includes('document:doc-1'))
})

test('79 governance migration uses canonical tables and RLS helpers', () => {
  const sql=fs.readFileSync('supabase/migrations/20260903213000_randguide_live_74_80.sql','utf8')
  assert.match(sql,/alter table public\.randai_procedures/)
  assert.match(sql,/randguide_procedure_versions/)
  assert.match(sql,/randguide_links/)
  assert.match(sql,/can_manage_randai_hotel\(hotel_id\)/)
  assert.match(sql,/randguide_publish_procedure/)
  assert.doesNotMatch(sql,/create table[^;]+randguide_procedures/i)
})

test('80 production gate blocks invalid approved knowledge and accepts canonical evidence', () => {
  const good=evaluateRandGuideReadiness({procedures:[procedure()],equipment:[],documents:[],sessions:[],graph:buildRandGuideGraph({hotelId:HOTEL})})
  assert.equal(good.ready,true)
  const bad=evaluateRandGuideReadiness({procedures:[procedure({riskLevel:'critical',caution:null})],equipment:[],documents:[],sessions:[]})
  assert.equal(bad.ready,false)
  assert.ok(bad.reasons.includes('UNPUBLISHABLE_APPROVED_PROCEDURES'))
})

test('RandGuide is promoted to LIVE with concrete evidence', () => {
  const module=getRandEcosystemManifest().find((item)=>item.id==='randguide')
  assert.equal(module.status,EcosystemStatus.LIVE)
  assert.ok(module.evidence.some((item)=>item.includes('20260903213000_randguide_live_74_80.sql')))
})
