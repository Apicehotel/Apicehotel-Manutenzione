import { spawnSync } from 'node:child_process'

const critical = [
  'test/current-architecture.test.js',
  'test/point5-operational.test.js',
  'test/point6-resilience.test.js',
  'test/point8-security.test.js',
  'test/point9-supremo-own-edit.test.js',
  'test/point10-housekeeping.test.js',
  'test/point11-multihotel.test.js',
  'test/point13-work-home.test.js',
  'test/point16-diagnostics.test.js',
  'test/point17-database-security.test.js',
  'test/point18-final-cleanup.test.js',
  'test/point20-supabase-rls-audit.test.js',
  'test/point21-auth-threat-model.test.js',
  'test/offline-resilience-v2.test.js',
  'test/offline-retry.test.js',
  'test/photo-pipeline-hardening.test.js',
  'test/issue-push-notifications.test.js',
  'test/intervention-assignment-notifications.test.js',
  'test/push-multihotel.test.js',
  'test/ntfy-profile.test.js',
  'test/notification-alias.test.js',
  'test/pwa.test.js',
  'test/weather-data.test.js',
]

const result = spawnSync(process.execPath, ['--test', ...critical], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status || 1)
console.log(`Critical gate OK: ${critical.length} suite critiche`)
