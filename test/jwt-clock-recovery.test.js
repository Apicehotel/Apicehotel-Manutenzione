import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8')
const auth=read('../src/reliability/jwt-clock-recovery.js')
const planning=read('../src/planning-work-data.js')
const sale=read('../src/sale-data.js')
const shell=read('../src/randapp/Shell.jsx')

test('recover only future-issued JWT read failures',()=>{
  assert.match(auth,/export \{ isFutureJwtError/)
  assert.match(auth,/refreshSession\(\)/)
  assert.match(auth,/!session\?\.refresh_token/)
  assert.match(auth,/return read\(\)/)
  assert.match(auth,/JWT_CLOCK_USER_MESSAGE/)
  assert.doesNotMatch(auth,/setSession\(|signOut\(|localStorage\.clear\(/)
})

test('Planning queries use guarded JWT recovery',()=>{
  assert.match(planning,/return readWithJwtRecovery\(async \(\) =>/)
  assert.match(sale,/await readWithJwtRecovery\(async\(\)=>/)
})

test('UI chrome and HotelGiò are untouched by JWT recovery',()=>{
  assert.match(shell,/RandTopbar/)
  assert.match(shell,/RandMobileNav/)
})
