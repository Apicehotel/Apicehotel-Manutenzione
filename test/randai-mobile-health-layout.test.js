import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const responsiveCss = readFileSync(new URL('../src/randai/control/randai-responsive.css', import.meta.url), 'utf8')
const authLayoutCss = readFileSync(new URL('../src/randai/auth/randai-auth-layout.css', import.meta.url), 'utf8')
const protectedRoute = readFileSync(new URL('../src/randai/auth/RandAIProtectedRoute.jsx', import.meta.url), 'utf8')

test('RandAI account actions remain in normal flow on phones', () => {
  const rule = authLayoutCss.match(/\.ra-tools\s*\{([^}]*)\}/)?.[1] || ''
  assert.match(rule, /position:\s*relative/)
  assert.match(rule, /inset:\s*auto/)
  assert.match(rule, /width:\s*100%/)
  assert.match(protectedRoute, /import\s+['"]\.\/randai-auth-layout\.css['"]?/)
  assert.match(authLayoutCss, /@media\s*\(max-width:\s*720px\)\s*\{\s*\.ra-tools\s*\{[^}]*padding-top:/)
  assert.doesNotMatch(authLayoutCss, /\.ra-tools\s*\{[^}]*position:\s*fixed/)
  assert.doesNotMatch(authLayoutCss, /\.ra-tools\s*\{[^}]*[;\s]bottom\s*:/)
})

test('RandCore health cards can shrink and wrap long status labels', () => {
  assert.match(responsiveCss, /\.rc-health-console \.rc-kpi,[\s\S]*?min-width:\s*0/)
  assert.match(responsiveCss, /\.rc-health-console \.rc-kpi \.rc-badge\s*\{[^}]*white-space:\s*normal/)
  assert.match(responsiveCss, /\.rc-health-console p,[\s\S]*?overflow-wrap:\s*anywhere/)
})
