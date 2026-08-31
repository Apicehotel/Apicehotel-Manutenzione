import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')
const TEST = path.join(ROOT, 'test')
const EXTENSIONS = ['.js', '.jsx', '.mjs', '.css']

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/') }

function specifiers(source) {
  const found = new Set()
  const patterns = [
    /(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
    /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g,
  ]
  for (const re of patterns) {
    let m
    while ((m = re.exec(source))) found.add(m[1])
  }
  return [...found]
}

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, ...EXTENSIONS.map((ext) => base + ext), ...EXTENSIONS.map((ext) => path.join(base, 'index' + ext))]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null
}

const srcFiles = walk(SRC).filter((f) => EXTENSIONS.includes(path.extname(f)))
const testFiles = walk(TEST).filter((f) => ['.js', '.mjs'].includes(path.extname(f)))
const graph = new Map()
const bareImports = new Set()

for (const file of [...srcFiles, ...testFiles]) {
  const source = fs.readFileSync(file, 'utf8')
  const deps = []
  for (const spec of specifiers(source)) {
    if (spec.startsWith('.')) {
      const resolved = resolveRelative(file, spec)
      if (resolved) deps.push(resolved)
    } else if (!spec.startsWith('/') && !spec.startsWith('http')) {
      bareImports.add(spec)
    }
  }
  graph.set(file, deps)
}

function reachableFrom(roots) {
  const seen = new Set()
  const stack = roots.filter(Boolean)
  while (stack.length) {
    const file = stack.pop()
    if (!file || seen.has(file)) continue
    seen.add(file)
    for (const dep of graph.get(file) || []) stack.push(dep)
  }
  return seen
}

const runtime = reachableFrom([path.join(SRC, 'main.jsx')])
const testReachable = reachableFrom(testFiles)
const unreachable = srcFiles.filter((f) => !runtime.has(f))
const testOnly = unreachable.filter((f) => testReachable.has(f))
const orphan = unreachable.filter((f) => !testReachable.has(f))

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const deps = Object.keys(pkg.dependencies || {})
const usedPackages = new Set([...bareImports].map((spec) => spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]))
const unusedPackages = deps.filter((dep) => !usedPackages.has(dep))

const report = {
  runtimeReachable: runtime.size,
  srcFiles: srcFiles.length,
  testOnly: testOnly.map(rel).sort(),
  orphan: orphan.map(rel).sort(),
  unusedPackages: unusedPackages.sort(),
  usedPackages: [...usedPackages].filter((x) => deps.includes(x)).sort(),
}

console.log('\n=== ZOMBIE AUDIT ===')
console.log(JSON.stringify(report, null, 2))

test('zombie audit report (intentional diagnostic failure)', () => {
  assert.fail(`ZOMBIE_AUDIT_REPORT=${JSON.stringify(report)}`)
})
