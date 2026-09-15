import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/randapp/telegram-navigation.css', import.meta.url), 'utf8')

test('Operatività resta content-sized su mobile e non crea spazio vuoto', () => {
  assert.match(css, /rs-content \.rs-randui-page--operational[\s\S]*min-height:\s*0\s*!important/)
  assert.match(css, /rs-randui-page--operational \.rs-operations-hub[\s\S]*align-self:\s*start/)
})
