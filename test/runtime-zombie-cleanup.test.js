import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const main=read('src/main.jsx')
const adaptive=read('src/randapp/adaptive-layout.css')
const foundation=read('src/randapp/randui/foundation.css')

test('runtime exposes only the canonical RandApp shell',()=>{
  assert.doesNotMatch(main,/randui-v2|ui-v2-preview|RandUiV2Preview/)
  assert.doesNotMatch(main,/urgent-shell-layout-fix\.css/)
  assert.match(main,/randui\/foundation\.css/)
})

test('adaptive layout is the only tablet shell geometry owner',()=>{
  assert.match(adaptive,/Canonical shell row contract/)
  assert.match(adaptive,/grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto/)
  assert.match(adaptive,/@media \(min-width:\s*768px\) and \(max-width:\s*1199px\)/)
  assert.doesNotMatch(foundation,/min-width:\s*1024px\) and \(max-width:\s*1199px/)
  assert.doesNotMatch(foundation,/height:\s*100dvh[\s\S]*max-height:\s*100dvh/)
})

test('historical documentation may remain but runtime duplicate owners cannot return',()=>{
  assert.doesNotMatch(main,/\.\/randapp\/randui-v2\//)
  assert.doesNotMatch(foundation,/\.rs-app\.rs-app--with-side[\s\S]*\.rs-bottomnav \{ display: grid !important; \}/)
})
