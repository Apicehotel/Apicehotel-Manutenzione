import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const main=fs.readFileSync('src/main.jsx','utf8')
const consoleUi=fs.readFileSync('src/randai/console/RandAIConsole.jsx','utf8')
const controlCenter=fs.readFileSync('src/randai/control/RandAIControlCenter.jsx','utf8')
const protectedRoute=fs.readFileSync('src/randai/auth/RandAIProtectedRoute.jsx','utf8')
const authClient=fs.readFileSync('src/randai/auth/randai-auth.js','utf8')
const authFn=fs.readFileSync('supabase/functions/randai-auth/index.ts','utf8')
const credentialMigration=fs.readFileSync('supabase/migrations/20260829134000_randai_role_credentials.sql','utf8')
const config=fs.readFileSync('src/config.js','utf8')
const controlCss=fs.readFileSync('src/randai/control/randai-control.css','utf8')
const authCss=fs.readFileSync('src/randai/auth/randai-auth.css','utf8')
const css=fs.readFileSync('src/randai/console/randai-console.css','utf8')
const externalMedia=fs.readFileSync('supabase/migrations/20260829123000_randai_document_external_media.sql','utf8')
const procedureLink=fs.readFileSync('supabase/migrations/20260829124500_randai_document_procedure_link.sql','utf8')

test('dedicated /randai route lazy-loads protected RandAI entry without mounting operational RandApp',()=>{
  assert.match(main,/const RandAIProtectedRoute = lazy\(\(\) => import\('\.\/randai\/auth\/RandAIProtectedRoute\.jsx'\)\)/)
  assert.match(main,/const randaiConsoleMatch = \/\^\\\/randai\\\/\?\$\/.test\(window\.location\.pathname\)/)
  assert.match(main,/randaiConsoleMatch \? <Suspense[\s\S]*?<RandAIProtectedRoute \/>[\s\S]*?<\/Suspense>/)
  assert.match(main,/: <><App \/><RandAIAssistant \/><\/>/)
  assert.match(main,/!randaiConsoleMatch/)
})

test('RandAI has its own role and username password credentials without changing PIN auth',()=>{
  assert.match(config,/'RandAI'/)
  assert.match(credentialMigration,/create table if not exists public\.randai_credentials/)
  assert.match(credentialMigration,/select 'RandAI', module, action, allowed/)
  assert.match(credentialMigration,/crypt\('00000000'/)
  assert.match(authFn,/\^\[A-Za-z0-9\]\{6,12\}\$/)
  assert.match(authFn,/role==="RandAI"/)
  assert.match(authClient,/loginRandAI/)
  assert.match(protectedRoute,/\.eq\('role','RandAI'\)/)
})

test('RandAI protected route can create access users and change password',()=>{
  assert.match(protectedRoute,/Accessi RandAI/)
  assert.match(protectedRoute,/Crea utente RandAI/)
  assert.match(protectedRoute,/changeRandAIPassword/)
  assert.match(authFn,/action==="create_user"/)
  assert.match(authFn,/action==="change_password"/)
  assert.match(authFn,/must_change_password:true/)
})

test('RandAI control center integrates operational modules and keeps knowledge console intact',()=>{
  assert.match(controlCenter,/fetchIssues/)
  assert.match(controlCenter,/fetchPlanned/)
  assert.match(controlCenter,/fetchUsers/)
  assert.match(controlCenter,/fetchAllSensors/)
  assert.match(controlCenter,/randai_procedures/)
  assert.match(controlCenter,/randai_equipment/)
  assert.match(controlCenter,/randai_documents/)
  assert.match(controlCenter,/RandAIKnowledgeConsole/)
})

test('RandAI console is admin and hotel scoped',()=>{
  assert.match(consoleUi,/can_access_admin/)
  assert.match(consoleUi,/\.in\('hotel_id',access\.hotels\)/)
  assert.match(consoleUi,/access\.hotels\.includes\(form\.hotel_id\)/)
  assert.match(controlCenter,/can_access_admin/)
  assert.match(controlCenter,/access\.hotels/)
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

test('RandAI console and auth are mobile safe-area aware and CSS scoped',()=>{
  assert.match(css,/safe-area-inset-bottom/)
  assert.match(css,/\.rk-shell input/)
  assert.match(controlCss,/safe-area-inset-bottom/)
  assert.match(controlCss,/\.rc-shell/)
  assert.match(authCss,/safe-area-inset-bottom/)
  assert.match(authCss,/\.ra-gate/)
})
