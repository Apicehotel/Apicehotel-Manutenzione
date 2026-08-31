import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const inventory = fs.readFileSync(new URL('../src/randapp/InventoryView.jsx', import.meta.url), 'utf8')
const shell = fs.readFileSync(new URL('../src/randapp/Shell.jsx', import.meta.url), 'utf8')
const nav = fs.readFileSync(new URL('../src/randapp/nav.js', import.meta.url), 'utf8')
const permissions = fs.readFileSync(new URL('../src/permissions.js', import.meta.url), 'utf8')
test('inventory is wired into RandApp',()=>{assert.match(shell,/InventoryView/);assert.match(nav,/Magazzino/);assert.match(permissions,/'inventory'/)})
test('inventory supports stock threshold and movements',()=>{assert.match(inventory,/Scorta minima/);assert.match(inventory,/Registra prelievo/);assert.match(inventory,/Registra carico/);assert.match(inventory,/Ultimi movimenti/)})
