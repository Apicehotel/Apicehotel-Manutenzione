import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('group3 does not add parallel orchestration frameworks to PWA dependencies',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 const names=[...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})]
 for(const fragment of ['trigger','inngest','mastra','langgraph']) assert.equal(names.some(name=>name.toLowerCase().includes(fragment)),false)
})
