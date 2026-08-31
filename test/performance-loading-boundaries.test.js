import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('main keeps standalone routes and RandAI out of the static entry graph', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /const App = lazy\(\(\) => import\('\.\/randapp\/App\.jsx'\)\)/)
  assert.match(main, /const RandAIAssistant = lazy\(\(\) => import\('\.\/randai\/RandAIAssistant\.jsx'\)\)/)
  assert.match(main, /const TechnicianPortal = lazy\(\(\) => import\('\.\/technician-portal\.jsx'\)\)/)
  assert.match(main, /const PublicIssueView = lazy\(\(\) => import\('\.\/public-issue-view\.jsx'\)\)/)
  assert.match(main, /const NtfyShortLink = lazy\(\(\) => import\('\.\/randapp\/ntfy\/NtfyShortLink\.jsx'\)\)/)
  assert.doesNotMatch(main, /import App from '\.\/randapp\/App\.jsx'/)
  assert.doesNotMatch(main, /import RandAIAssistant from/)
})

test('RandAI assistant is loaded only for an authenticated RandApp session', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /function AuthenticatedRandAI\(\)/)
  assert.match(main, /useState\(\(\) => Boolean\(loadSession\(\)\)\)/)
  assert.match(main, /window\.addEventListener\(SESSION_EVENT, refresh\)/)
  assert.match(main, /if \(!active\) return null/)
})

test('PWA registration remains immediate while authenticated operational services stay deferred', async () => {
  const main = await source('src/main.jsx')
  for (const module of ['push.js', 'notification-onboarding.js', 'presence-status.js', 'urgent-ownership-guard.js']) {
    assert.match(main, new RegExp(`import\\('\\./${module.replace('.', '\\.')}'\\)`))
  }
  assert.match(main, /import \{ registerPwa \} from '\.\/pwa\.js'/)
  assert.match(main, /registerPwa\(\)/)
  assert.doesNotMatch(main, /afterPageLoad\(\(\) => import\('\.\/pwa\.js'\)/)
  assert.match(main, /const session = loadSession\(\)/)
  assert.match(main, /if \(!session\) return/)
  assert.match(main, /if \(loadSession\(\)\) afterPageLoad\(startOperationalRuntime\)/)
})

test('deployment recovery and visual initialization remain immediate', async () => {
  const main = await source('src/main.jsx')
  assert.match(main, /installDeploymentRecovery\(\)/)
  assert.match(main, /initUiSize\(\)/)
  assert.match(main, /initTheme\(\)/)
})
