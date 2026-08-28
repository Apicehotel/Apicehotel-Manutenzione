import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('admin usage dashboard shows both infrastructure providers without fake billing quotas', async () => {
  const usage = await source('src/randapp/admin/UsageTab.jsx')
  assert.match(usage, /Supabase/)
  assert.match(usage, /Vercel/)
  assert.match(usage, /PRO/)
  assert.match(usage, /get_usage_stats/)
  assert.match(usage, /randapp-health/)
  assert.match(usage, /__RANDAPP_BUILD__/)
  assert.doesNotMatch(usage, /500\s*GB|250\s*GB|8\s*GB\s*\/|1M\s*invocations/i)
})

test('admin usage dashboard renders real database storage connections activity and per-hotel metrics', async () => {
  const usage = await source('src/randapp/admin/UsageTab.jsx')
  for (const field of ['db_connections','db_max_connections','storage_bytes','storage_files','maintenance_photos_bytes','maintenance_photos_files','activity_30d','per_hotel']) {
    assert.match(usage, new RegExp(field))
  }
  assert.match(usage, /ActivityChart/)
  assert.match(usage, /HOTELS\.map/)
})

test('usage SQL stays admin-only and calculates live storage and 30 day activity', async () => {
  const migration = await source('supabase/migrations/20260828144000_enhance_usage_dashboard_metrics.sql')
  assert.match(migration, /auth\.uid\(\) is null/)
  assert.match(migration, /can_admin_hotel/)
  assert.match(migration, /storage\.objects/)
  assert.match(migration, /pg_stat_database/)
  assert.match(migration, /generate_series\(current_date - 29/)
  assert.match(migration, /maintenance-photos/)
})

test('usage dashboard styling is responsive and uses the existing RandApp design tokens', async () => {
  const css = await source('src/randapp/admin/usage.css')
  assert.match(css, /var\(--rs-cyan\)/)
  assert.match(css, /rs-provider-grid/)
  assert.match(css, /rs-usage-mini-grid/)
  assert.match(css, /@media\(max-width:520px\)/)
})
