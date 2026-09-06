import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('group3 package and lock keep the same dependency ownership',()=>{
 const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 const lock=JSON.parse(fs.readFileSync(new URL('../package-lock.json',import.meta.url),'utf8'))
 assert.deepEqual(Object.keys(pkg.dependencies).sort(),Object.keys(lock.packages[''].dependencies).sort())
 assert.deepEqual(Object.keys(pkg.devDependencies).sort(),Object.keys(lock.packages[''].devDependencies).sort())
})
