import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),'utf8')
const network=read('../src/reliability/jwt-network-recovery.js')
const app=read('../src/randapp/App.jsx')
test('JWT rejections are notified across MultiHotel reads and writes',()=>{
 assert.match(network,/apice-jwt-clock-rejected/)
 assert.match(network,/\['GET', 'HEAD'\]/)
 assert.match(network,/\/functions/)
 assert.match(network,/warn\(\); return response/)
})
test('central RandApp session recovers once, then requests a new PIN login',()=>{
 assert.match(app,/addEventListener\('apice-jwt-clock-rejected'/)
 assert.match(app,/auth\.refreshSession\(\)/)
 assert.match(app,/auth\.getUser\(\)/)
 assert.match(app,/clearSession\(\)/)
 assert.match(app,/window\.location\.reload\(\)/)
 assert.match(app,/90000/)
 assert.match(app,/JWT_CLOCK_USER_MESSAGE/)
 assert.match(app,/Accesso richiesto di nuovo/)
})
