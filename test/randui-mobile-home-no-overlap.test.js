import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = () => readFile(new URL('../src/randapp/randui-material.css', import.meta.url), 'utf8')

test('Material mobile Home keeps KPI to two columns and card headers in flow', async () => {
  const s = await css()
  assert.match(s, /\.rnx-home \.rnx-kpi-grid\[data-count="3"\]/)
  assert.match(s, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/)
  assert.match(s, /\.rnx-home \.rnx-panel>\.rnx-panel__head/)
  assert.match(s, /\.rnx-home \.rnx-chartcard__plot/)
  assert.match(s, /margin-top:0/)
})
