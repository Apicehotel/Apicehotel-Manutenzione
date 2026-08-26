from pathlib import Path

p = Path('src/randapp/Settings.jsx')
s = p.read_text()
old = """  const groups = useMemo(() => {\n    const known = ROLES.map((role) => ({ role, list: filtered.filter((u) => u.role === role) })).filter((g) => g.list.length)\n    const other = filtered.filter((u) => !ROLES.includes(u.role))\n    return other.length ? [...known, { role: 'Altro', list: other }] : known\n  }, [filtered])\n"""
new = """  const groups = useMemo(() => {\n    const housekeepingRoles = new Set(['Governante', 'Capo Governante'])\n    const housekeepingUsers = filtered.filter((u) => housekeepingRoles.has(u.role))\n    const housekeepingByHotel = HOTELS.map((hotel) => ({\n      role: `Housekeeping · ${hotel.short}`,\n      hotelId: hotel.id,\n      list: housekeepingUsers.filter((u) => (u.hotels || []).includes(hotel.id)),\n    })).filter((g) => g.list.length)\n    const known = ROLES.filter((role) => !housekeepingRoles.has(role))\n      .map((role) => ({ role, list: filtered.filter((u) => u.role === role) }))\n      .filter((g) => g.list.length)\n    const other = filtered.filter((u) => !ROLES.includes(u.role))\n    return [...housekeepingByHotel, ...known, ...(other.length ? [{ role: 'Altro', list: other }] : [])]\n  }, [filtered])\n"""
if old not in s:
    raise SystemExit('groups block not found')
s = s.replace(old, new, 1)
old2 = """            {openGroups[role] !== false && list.map((u) => (\n              <Card key={u.auth_user_id || u.id} className=\"rs-usercard\">\n"""
new2 = """            {openGroups[role] !== false && list.map((u) => (\n              <Card key={`${role}-${u.auth_user_id || u.id}`} className=\"rs-usercard\">\n"""
if old2 not in s:
    raise SystemExit('card key block not found')
s = s.replace(old2, new2, 1)
p.write_text(s)

# Permanent regression test
Path('test/housekeepers-by-hotel.test.js').write_text("""import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { readFile } from 'node:fs/promises'\n\nconst settings = await readFile(new URL('../src/randapp/Settings.jsx', import.meta.url), 'utf8')\nconst migration = await readFile(new URL('../supabase/migrations/20260826143000_fix_giulia_head_housekeeper_and_scope.sql', import.meta.url), 'utf8')\n\ntest('housekeepers are grouped by hotel instead of one global role bucket', () => {\n  assert.match(settings, /Housekeeping · \\${hotel\\.short}/)\n  assert.match(settings, /housekeepingRoles = new Set\\(\\['Governante', 'Capo Governante'\\]\\)/)\n  assert.match(settings, /\\(u\\.hotels \\|\\| \\[\\]\\)\\.includes\\(hotel\\.id\\)/)\n})\n\ntest('Giulia head-housekeeper migration accepts full display names and scopes Hotel Gio only', () => {\n  assert.match(migration, /hm\\.hotel_id = 'hotelgio'/)\n  assert.match(migration, /set role = 'Capo Governante'/)\n  assert.match(migration, /\\^giulia\\(\\?:\\\\s\\|\\$\\)/)\n  assert.doesNotMatch(migration, /hm\\.hotel_id = 'chocohotel'/)\n  assert.doesNotMatch(migration, /hm\\.hotel_id = 'brigantino'/)\n})\n""")
