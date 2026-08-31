import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8')

test('presence is stored with one physical hotel id', async () => {
  const [migration, status] = await Promise.all([
    read('../supabase/migrations/20260831141500_scope_user_presence_to_single_hotel.sql'),
    read('../supabase/functions/presence-status/index.ts'),
  ])
  assert.match(migration, /in_struttura_hotel_id/)
  assert.match(migration, /idx_utenti_active_presence_hotel/)
  assert.match(status, /hotel_id: present \? hotelId : null/)
  assert.match(status, /in_struttura_hotel_id/)
})

test('frontend moves presence to current hotel instead of creating parallel presence', async () => {
  const [auth, chip, sync] = await Promise.all([
    read('../src/auth-data.js'),
    read('../src/randapp/PresenceChip.jsx'),
    read('../src/presence-status.js'),
  ])
  assert.match(auth, /setOwnPresence\(present, hotelId = null\)/)
  assert.match(auth, /hotel_id: present \? hotelId : null/)
  assert.match(chip, /const presentHere = Boolean\(present && activeHotel\?\.id && presenceHotelId === activeHotel\.id\)/)
  assert.match(chip, /setOwnPresence\(next, next \? activeHotel\.id : null\)/)
  assert.match(sync, /\.eq\('in_struttura_hotel_id', hotelId\)/)
})

test('presence control is a labeled pill rather than an unlabeled dot', async () => {
  const [chip, css] = await Promise.all([
    read('../src/randapp/PresenceChip.jsx'),
    read('../src/randapp/presence-dot.css'),
  ])
  assert.match(chip, /className="rs-presence-chip"/)
  assert.match(chip, /visibleLabel/)
  assert.match(css, /\.rs-presence-chip/)
  assert.match(css, /data-here='false'/)
})

test('presence and notification header actions scale together in Piccolo Normale and Grande', async () => {
  const [size, presenceCss, headerCss] = await Promise.all([
    read('../src/randapp/ui-size.js'),
    read('../src/randapp/presence-dot.css'),
    read('../src/randapp/header-mobile.css'),
  ])
  assert.match(size, /\['small', 'Piccolo'\]/)
  assert.match(size, /\['normal', 'Normale'\]/)
  assert.match(size, /\['large', 'Grande'\]/)
  assert.match(presenceCss, /calc\(40px \* var\(--rs-scale\)\)/)
  assert.match(presenceCss, /calc\(9px \* var\(--rs-scale\)\)/)
  assert.match(headerCss, /--rs-header-action-size:/)
  assert.match(headerCss, /height: var\(--rs-header-action-size\)/)
  assert.match(headerCss, /width: var\(--rs-header-action-size\)/)
  assert.match(headerCss, /calc\(21px \* var\(--rs-scale\)\)/)
})
