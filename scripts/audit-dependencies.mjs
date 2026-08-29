import fs from 'node:fs'
import path from 'node:path'
import module from 'node:module'

const root = process.cwd()
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const declared = new Set([...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})])
const builtins = new Set(module.builtinModules.flatMap((name) => [name, `node:${name}`]))
const extensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', '.git', '.agents', 'coverage', 'test-results', 'playwright-report'])
const used = new Map()
const scanned = []

function packageName(specifier) {
  if (!specifier) return null
  if (specifier.includes('${')) return null
  if (
    specifier.startsWith('.') ||
    specifier.startsWith('/') ||
    specifier.startsWith('node:') ||
    specifier.startsWith('npm:') ||
    specifier.startsWith('jsr:') ||
    specifier.startsWith('deno:') ||
    specifier.startsWith('http:') ||
    specifier.startsWith('https:') ||
    builtins.has(specifier)
  ) return null
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/')
  return specifier.split('/')[0]
}

function collectFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) collectFiles(path.join(dir, entry.name))
      continue
    }
    const file = path.join(dir, entry.name)
    if (extensions.has(path.extname(entry.name))) scanned.push(file)
  }
}

collectFiles(root)

const patterns = [
  /^\s*import\s+(?:[^'"`]*?\s+from\s+)?['"`]([^'"`]+)['"`]/gm,
  /^\s*export\s+[^'"`]*?\s+from\s+['"`]([^'"`]+)['"`]/gm,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

for (const file of scanned) {
  const source = fs.readFileSync(file, 'utf8')
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source))) {
      const name = packageName(match[1])
      if (!name) continue
      if (!used.has(name)) used.set(name, new Set())
      used.get(name).add(path.relative(root, file))
    }
  }
}

const missing = [...used.keys()].filter((name) => !declared.has(name)).sort()
const unused = [...declared].filter((name) => !used.has(name)).sort()
const report = {
  scannedFiles: scanned.length,
  declared: declared.size,
  usedDeclared: [...used.keys()].filter((name) => declared.has(name)).sort(),
  unused,
  missing,
  usage: Object.fromEntries([...used.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, files]) => [name, [...files].sort()])),
}

console.log(JSON.stringify(report, null, 2))
if (missing.length) {
  console.error(`Dependency audit FAILED: ${missing.length} import(s) non dichiarati`)
  process.exit(1)
}
if (unused.length) {
  console.error(`Dependency audit FAILED: ${unused.length} dipendenze dichiarate senza utilizzo rilevato: ${unused.join(', ')}`)
  process.exit(1)
}
console.log(`Dependency audit OK: ${report.usedDeclared.length}/${declared.size} dipendenze dichiarate rilevate; nessun import Node/Vite mancante`)
