import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const main=fs.readFileSync('src/main.jsx','utf8')
const consoleUi=fs.readFileSync('src/randai/console/RandAIConsole.jsx','utf8')
const css=fs.readFileSync('src/randai/console/randai-console.css','utf8')
const externalMedia=fs.readFileSync('supabase/migrations/20260829123000_randai_document_external_media.sql','utf8')
const procedureLink=fs.readFileSync('supabase/migrations/20260829124500_randai_document_procedure_link.sql','utf8')

test('dedicated /randai route does not mount operational RandApp',()=>{
  assert.match(main,/randaiConsoleMatch/)
  assert.match(main,/randaiConsoleMatch \? <RandAIConsole \/>/)
  assert.match(main,/!randaiConsoleMatch/)
})

test('RandAI console is admin and hotel scoped',()=>{
  assert.match(consoleUi,/can_access_admin/)
  assert.match(consoleUi,/\.in\('hotel_id',access\.hotels\)/)
  assert.match(consoleUi,/access\.hotels\.includes\(form\.hotel_id\)/)
})

test('RandAI console supports draft approval Drive media and preview',()=>{
  assert.match(consoleUi,/Salva bozza/)
  assert.match(consoleUi,/Approva/)
  assert.match(consoleUi,/drive\.google\.com/)
  assert.match(consoleUi,/randai_documents/)
  assert.match(consoleUi,/procedure_id/)
  assert.match(consoleUi,/randai-assistant/)
})

test('external Drive media is separate from Supabase storage and linked to knowledge',()=>{
  assert.match(externalMedia,/external_url/)
  assert.match(externalMedia,/media_kind/)
  assert.match(procedureLink,/procedure_id text references public\.randai_procedures/)
})

test('RandAI console is mobile safe-area aware and CSS scoped',()=>{
  assert.match(css,/safe-area-inset-bottom/)
  assert.match(css,/\.rk-shell input/)
})
