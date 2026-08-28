import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const entryKey = Object.entries(manifest).find(([, item]) => item.isEntry)?.[0]
if (!entryKey) throw new Error('Vite manifest: entry chunk non trovato')
const visited = new Set()
let total = 0
async function visit(key) {
  const item = manifest[key]
  if (!item?.file || visited.has(item.file)) return
  visited.add(item.file)
  total += (await stat(path.join('dist', item.file))).size
  for (const dep of item.imports || []) await visit(dep)
}
await visit(entryKey)
const limit = 600 * 1024
console.log(`Initial JS: ${(total/1024).toFixed(1)} KiB across ${visited.size} static chunk(s); budget ${limit/1024} KiB`)
if (total > limit) throw new Error(`Initial JS bundle oltre budget: ${total} > ${limit}`)
for (const file of visited) { const size = (await stat(path.join('dist', file))).size; if (size > 500 * 1024) throw new Error(`Chunk iniziale oltre 500 KiB: ${file} = ${size}`) }
const xlsx = Object.values(manifest).find((item) => String(item.src||'').includes('xlsx') || String(item.file||'').includes('xlsx'))
if (xlsx && visited.has(xlsx.file)) throw new Error('xlsx è finito nel percorso JS iniziale')
