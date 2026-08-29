import { spawnSync } from 'node:child_process'

const packs = [
  {
    repo: 'supabase/agent-skills',
    skills: ['supabase-postgres-best-practices'],
  },
  {
    repo: 'openai/skills',
    skills: ['security-threat-model', 'security-best-practices', 'playwright', 'gh-fix-ci'],
  },
  {
    repo: 'trailofbits/skills',
    skills: ['audit-context-building', 'differential-review', 'insecure-defaults', 'sharp-edges', 'static-analysis'],
  },
  {
    repo: 'addyosmani/web-quality-skills',
    skills: ['web-quality-audit', 'core-web-vitals', 'accessibility'],
  },
]

for (const pack of packs) {
  const args = ['--yes', 'skills', 'add', pack.repo, '-y']
  for (const skill of pack.skills) args.push('--skill', skill)

  console.log(`\n==> ${pack.repo}: ${pack.skills.join(', ')}`)
  const result = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('\nRandApp agent skills installate dalla selezione curata. Eseguire npm run test:agent-toolchain prima di usarle come gate.')
