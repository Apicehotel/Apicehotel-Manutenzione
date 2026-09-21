import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildMyWorkPreview,
  buildNextCommitment,
  syncStatusMessage,
  weatherSummary,
} from '../src/home-widgets-logic.js'

const now = Date.parse('2026-09-21T12:00:00.000Z')

test('buildMyWorkPreview keeps assigned planned and taken urgents', () => {
  const rows = buildMyWorkPreview({
    now,
    user: { name: 'Luca Verdi' },
    planned: [
      { id: 'p1', status: 'pending', assignees: ['Luca Verdi'], notes: 'Rubinetto', location: '214', scheduledAt: now + 3600_000 },
      { id: 'p2', status: 'done', assignees: ['Luca Verdi'], notes: 'Fatto', location: '100', scheduledAt: now },
      { id: 'p3', status: 'pending', assignees: ['Altro'], notes: 'Non mio', location: '300', scheduledAt: now },
    ],
    urgents: [
      { id: 'u1', status: 'presa_in_carico', takenBy: 'luca verdi', location: 'Hall', note: 'Allarme', takenAt: now },
      { id: 'u2', status: 'aperta', takenBy: null, location: 'Bar' },
    ],
  })
  assert.equal(rows.length, 2)
  assert.equal(rows[0].kind, 'urgent')
  assert.equal(rows[1].title, 'Rubinetto')
  assert.equal(rows[1].route, 'my-work')
})

test('buildNextCommitment picks the soonest upcoming item', () => {
  const next = buildNextCommitment({
    now,
    user: { name: 'Luca', role: 'manutentore' },
    planned: [
      { id: 'late', status: 'pending', scheduledAt: now + 4 * 3600_000, notes: 'Tardi', location: 'A' },
      { id: 'soon', status: 'pending', scheduledAt: now + 1800_000, notes: 'Presto', location: 'B', assignees: ['Luca'] },
    ],
    reminders: [
      { id: 'r1', active: true, target_roles: ['manutentore'], repeat_kind: 'daily', times: ['18:00'], message: 'Check esterno' },
    ],
    reminderDueToday: () => true,
  })
  assert.equal(next.id, 'planned-soon')
  assert.equal(next.eyebrow, 'Tuo intervento')
  assert.match(next.meta, /B/)
})

test('weatherSummary always returns a compact operational card', () => {
  assert.deepEqual(weatherSummary({ level: 'ok', gust: 12, rainProbability: 10 }).title, 'Meteo operativo')
  assert.equal(weatherSummary({ level: 'warning', message: 'Chiudere ombrelloni' }).title, 'Attenzione meteo')
  assert.equal(weatherSummary(null), null)
})

test('syncStatusMessage stays hidden when clean online', () => {
  assert.equal(syncStatusMessage({ online: true, pending: 0, blocked: 0 }), null)
  assert.equal(syncStatusMessage({ online: false, pending: 2 }).tone, 'offline')
  assert.equal(syncStatusMessage({ online: true, pending: 3, blocked: 0 }).tone, 'pending')
  assert.equal(syncStatusMessage({ online: true, pending: 0, blocked: 1 }).tone, 'blocked')
})

test('Home mounts the operational widget set from the proposal', () => {
  const home = fs.readFileSync(new URL('../src/randapp/Home.jsx', import.meta.url), 'utf8')
  const css = fs.readFileSync(new URL('../src/randapp/home-operational.css', import.meta.url), 'utf8')
  assert.match(home, /data-testid="home-my-work"/)
  assert.match(home, /data-testid="home-next-commitment"/)
  assert.match(home, /data-testid="home-sync"/)
  assert.match(home, /data-testid="home-shortcuts"/)
  assert.match(home, /data-testid="weather-widget"/)
  assert.match(home, /data-testid="home-you"/)
  assert.match(home, /buildMyWorkPreview/)
  assert.match(home, /buildNextCommitment/)
  assert.match(home, /weatherSummary/)
  assert.match(home, /syncStatusMessage/)
  assert.match(home, /Magazzino/)
  assert.doesNotMatch(home, /!focusOnly&&<>[\s\S]*SCORCIATOIE/)
  const you = home.indexOf('data-testid="home-you"')
  const priority = home.indexOf('<h2>Cosa fare adesso</h2>')
  assert.ok(you >= 0 && priority > you, 'personal block must sit above the hotel priority queue')
  assert.match(home, /slice\(0,4\)/)
  assert.match(css, /\.rs-workhome__sync/)
  assert.match(css, /\.rs-workhome__mywork/)
  assert.match(css, /\.rs-workhome__next/)
  assert.match(css, /\.rs-workhome__you/)
  assert.match(css, /\.rs-workhome__weather\.is-ok/)
})
