import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

test('RandUI rich primitives stay native and dependency-free', () => {
  const source = read('src/randapp/randui/advanced-primitives.jsx')
  for (const name of ['LayeredCard','StatCard','StatusChip','ProgressMeter','ActivityTimeline','DataList','CommandSurface','SkeletonBlock']) {
    assert.match(source, new RegExp(`export function ${name}`))
  }
  assert.doesNotMatch(source, /from ['"](?:framer-motion|motion|@radix|shadcn|reui|motiq|velora|radian)/)
})

test('UI learning catalog persists source knowledge and patterns', () => {
  const catalog = JSON.parse(read('src/randapp/randui/ui-learning-catalog.json'))
  assert.ok(catalog.sources.length >= 8)
  assert.ok(catalog.patternFamilies.activityTimeline)
  assert.ok(catalog.patternFamilies.commandSurface)
  assert.ok(catalog.principles.includes('one canonical RandUI runtime'))
})

test('UI library CSS honors reduced motion', () => {
  const css = read('src/randapp/randui/ui-library.css')
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(css, /rs-randui-skeleton/)
  assert.match(css, /rs-randui-command/)
})
