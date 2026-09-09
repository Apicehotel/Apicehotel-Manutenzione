import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve('rand-skills')
const requiredHeadings = ['# Scope', '# Permissions', '# Allowed actions', '# Forbidden actions', '# Workflow', '# Validation']
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (!match) return null
  const fields = Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const index = line.indexOf(':')
    if (index < 0) return [line.trim(), '']
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
  }))
  return fields
}

export function validateRandSkills(baseDir = root) {
  const errors = []
  if (!fs.existsSync(baseDir)) return { ok: false, errors: ['rand-skills directory missing'], skills: [] }

  const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .map((entry) => entry.name)
    .sort()

  for (const dir of dirs) {
    const manifestPath = path.join(baseDir, dir, 'SKILL.md')
    if (!fs.existsSync(manifestPath)) {
      errors.push(`${dir}: SKILL.md missing`)
      continue
    }
    const source = fs.readFileSync(manifestPath, 'utf8')
    const frontmatter = parseFrontmatter(source)
    if (!frontmatter) {
      errors.push(`${dir}: YAML frontmatter missing`)
      continue
    }
    if (!namePattern.test(frontmatter.name || '')) errors.push(`${dir}: invalid name`)
    if (frontmatter.name !== dir) errors.push(`${dir}: frontmatter name must match directory`)
    if (!frontmatter.description || frontmatter.description.length < 24) errors.push(`${dir}: description is too short`)
    for (const heading of requiredHeadings) {
      if (!source.includes(heading)) errors.push(`${dir}: missing ${heading}`)
    }
    if (!source.includes('hotel') && dir !== 'repo-radar') errors.push(`${dir}: hotel scope must be explicit`)
  }

  if (dirs.length < 7) errors.push(`expected at least 7 production skills, found ${dirs.length}`)
  return { ok: errors.length === 0, errors, skills: dirs }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateRandSkills()
  if (!result.ok) {
    console.error(result.errors.join('\n'))
    process.exit(1)
  }
  console.log(`RandSkills valid: ${result.skills.length} skills (${result.skills.join(', ')})`)
}
