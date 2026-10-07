import fs from 'node:fs'
import path from 'node:path'

export function findSkillManifests(baseDir) {
  const root = path.resolve(baseDir)
  const found = []

  function visit(current) {
    if (!fs.existsSync(current)) return
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        visit(full)
        continue
      }
      if (entry.isFile() && entry.name === 'SKILL.md') found.push(full)
    }
  }

  visit(root)
  return found.sort()
}

export function skillPackagesFromRepository(baseDir) {
  return findSkillManifests(baseDir).map((manifestPath) => ({
    manifestPath,
    rootDir: path.dirname(manifestPath),
    relativeManifestPath: path.relative(path.resolve(baseDir), manifestPath).split(path.sep).join('/'),
  }))
}
