import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=(path)=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const issueAI=read('src/randapp/RandAISuggestion.jsx'),interventionAI=read('src/randapp/OperationalRandAI.jsx'),issues=read('src/randapp/Issues.jsx'),interventions=read('src/randapp/operations/InterventionsView.jsx'),css=read('src/randapp/randai-suggestion.css')
test('issue RandAI is a compact contextual presence after the timeline',()=>{assert.match(issueAI,/rs-randai-presence/);assert.match(issueAI,/Chiedi a RandAI/);assert.doesNotMatch(issueAI,/>Apri RandAI</);assert.ok(issues.indexOf('<RandAISuggestion')>issues.indexOf('<OperationalTimeline events={timelineEvents} />'));assert.match(issues,/user=\{user\}/)})
test('intervention RandAI reuses the existing context contract and stays read-only',()=>{assert.match(interventionAI,/createInterventionContextEnvelope/);assert.match(interventionAI,/retrieveRandAIGuidance/);assert.match(interventionAI,/Solo lettura: RandAI non modifica questo intervento da qui/);assert.doesNotMatch(interventionAI,/prepareRandAIAction|executeRandAIAction/);assert.match(interventions,/<OperationalRandAI hotelId=\{hotel\.id\}/)})
test('closed presence is visually quiet and mobile-safe',()=>{assert.match(css,/\.rs-randai-presence\s*\{[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);assert.match(css,/@media \(max-width:\s*520px\)[\s\S]*\.rs-randai-presence/s)})
