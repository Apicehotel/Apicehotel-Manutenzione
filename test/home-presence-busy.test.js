import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildColleaguePresenceRows,
  isPresenceActive,
  namesMatch,
  normalizePersonName,
  PRESENCE_MAX_MS,
} from '../src/home-presence-logic.js'

const now = Date.parse('2026-09-21T12:00:00.000Z')
const freshSince = new Date(now - 30 * 60 * 1000).toISOString()
const staleSince = new Date(now - PRESENCE_MAX_MS - 60_000).toISOString()

test('normalizePersonName collapses accents and spacing', () => {
  assert.equal(normalizePersonName('  Mario  Rossi '), 'mario rossi')
  assert.equal(normalizePersonName('José García'), 'jose garcia')
})

test('namesMatch tolerates accent and case differences', () => {
  assert.equal(namesMatch('Mario Rossi', 'mario rossi'), true)
  assert.equal(namesMatch('José', 'Jose'), true)
  assert.equal(namesMatch('Mario', 'Luigi'), false)
  assert.equal(namesMatch('', 'Mario'), false)
})

test('isPresenceActive respects the 7h20 auto-expire window', () => {
  assert.equal(isPresenceActive({ in_struttura: true, in_struttura_dal: freshSince }, now), true)
  assert.equal(isPresenceActive({ in_struttura: true, in_struttura_dal: staleSince }, now), false)
  assert.equal(isPresenceActive({ in_struttura: false, in_struttura_dal: freshSince }, now), false)
})

test('buildColleaguePresenceRows marks busy from presa_in_carico takenBy', () => {
  const rows = buildColleaguePresenceRows({
    now,
    people: [
      { id: '1', nome: 'Anna Bianchi', ruolo: 'manutentore', active: true, in_struttura: true, in_struttura_dal: freshSince },
      { id: '2', nome: 'Luca Verdi', ruolo: 'manutentore', active: true, in_struttura: true, in_struttura_dal: freshSince },
      { id: '3', nome: 'Vecchio', ruolo: 'manutentore', active: true, in_struttura: true, in_struttura_dal: staleSince },
      { id: '4', nome: 'Portiere', ruolo: 'Portiere Notturno', active: true, in_struttura: true, in_struttura_dal: freshSince },
      { id: '5', nome: 'Guest', ruolo: 'Governante', active: true, in_struttura: true, in_struttura_dal: freshSince },
    ],
    urgents: [
      { id: 'u1', status: 'presa_in_carico', takenBy: 'anna bianchi', location: 'Reception' },
      { id: 'u2', status: 'presa_in_carico', takenBy: 'Anna Bianchi', note: 'Perdita acqua' },
      { id: 'u3', status: 'aperta', takenBy: null, location: 'Bar' },
      { id: 'u4', status: 'completata', takenBy: 'Luca Verdi', location: 'Piscina' },
    ],
  })

  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((row) => row.name), ['Anna Bianchi', 'Luca Verdi', 'Portiere'])
  assert.equal(rows[0].busy, true)
  assert.equal(rows[0].takenCount, 2)
  assert.match(rows[0].detail, /Reception/)
  assert.equal(rows[1].busy, false)
  assert.equal(rows[1].detail, 'Libero')
  assert.equal(rows[2].busy, false)
})

test('Home wires presence fetch and busy colleague widget', () => {
  const home = fs.readFileSync(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/randapp/home-operational.css', import.meta.url), 'utf8')
  assert.match(home, /fetchPeopleInStructure\(hotel\.id\)/)
  assert.match(home, /buildColleaguePresenceRows/)
  assert.match(home, /data-testid="home-presence"/)
  assert.match(home, /Impegnato/)
  assert.match(home, /Libero/)
  assert.match(home, /onNavigate\?\.\('urgent'\)/)
  assert.match(css, /\.rs-workhome__desk-chip\.is-busy/)
  assert.match(css, /\.rs-workhome__colleague-dot/)
})
