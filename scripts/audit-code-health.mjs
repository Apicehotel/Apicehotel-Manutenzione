import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const roots = ['src', 'scripts', 'test', 'supabase/functions']
const extensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', '.git', '.agents', 'coverage', 'test-results', 'playwright-report', 'artifacts'])
const rows = []
const hardFailures = []

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) walk(path.join(dir, entry.name))
      continue
    }
    if (!extensions.has(path.extname(entry.name))) continue
    const file = path.join(dir, entry.name)
    const source = fs.readFileSync(file, 'utf8')
    const rel = path.relative(root, file)
    const lines = source.split(/\r?\n/).length
    const bytes = Buffer.byteLength(source)
    const todos = (source.match(/\b(?:TODO|FIXME|HACK)\b/g) || []).length
    const debuggerStatements = (source.match(/\bdebugger\s*;/g) || []).length
    const conflictMarkers = (source.match(/^(?:<{7}|={7}|>{7})/gm) || []).length
    rows.push({ file: rel, lines, bytes, todos, debuggerStatements, conflictMarkers })
    if (debuggerStatements) hardFailures.push(`${rel}: ${debuggerStatements} debugger statement`)
    if (conflictMarkers) hardFailures.push(`${rel}: ${conflictMarkers} merge conflict marker`)
    if (bytes > 500_000) hardFailures.push(`${rel}: source file oltre 500 KB (${bytes} byte)`)
  }
}

for (const base of roots) walk(path.join(root, base))

const largest = [...rows].sort((a, b) => b.lines - a.lines).slice(0, 15)
const todoFiles = rows.filter((row) => row.todos > 0).sort((a, b) => b.todos - a.todos)
const summary = {
  scannedFiles: rows.length,
  totalLines: rows.reduce((sum, row) => sum + row.lines, 0),
  todoMarkers: rows.reduce((sum, row) => sum + row.todos, 0),
  todoFiles: todoFiles.slice(0, 20),
  largest,
  hardFailures,
}

console.log(JSON.stringify(summary, null, 2))
if (hardFailures.length) {
  console.error(`Code health FAILED: ${hardFailures.length} problema/i bloccante/i`)
  process.exit(1)
}
console.log(`Code health OK: ${rows.length} file, ${summary.totalLines} righe; nessun debugger, merge marker o file >500 KB`)
