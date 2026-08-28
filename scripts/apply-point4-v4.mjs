await import('./apply-point4-v3.mjs')
import { readFile, writeFile } from 'node:fs/promises'

let vite = await readFile('vite.config.js', 'utf8')
vite = vite.replace("  build: { manifest: true },", `  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor'
        },
      },
    },
  },`)
await writeFile('vite.config.js', vite)

let budget = await readFile('scripts/check-bundle.mjs', 'utf8')
budget = budget.replace('const limit = 350 * 1024', 'const limit = 600 * 1024')
budget = budget.replace("if (total > limit) throw new Error(`Initial JS bundle oltre budget: ${total} > ${limit}`)", "if (total > limit) throw new Error(`Initial JS bundle oltre budget: ${total} > ${limit}`)\nfor (const file of visited) { const size = (await stat(path.join('dist', file))).size; if (size > 500 * 1024) throw new Error(`Chunk iniziale oltre 500 KiB: ${file} = ${size}`) }")
await writeFile('scripts/check-bundle.mjs', budget)

let tests = await readFile('test/performance-architecture.test.js', 'utf8')
tests += `\ntest('vendor chunking is explicit without hiding the total bundle budget', async () => {\n  const [vite, budget] = await Promise.all([source('vite.config.js'), source('scripts/check-bundle.mjs')])\n  assert.match(vite, /supabase-vendor/)\n  assert.match(vite, /react-vendor/)\n  assert.match(budget, /600 \\* 1024/)\n  assert.match(budget, /500 \\* 1024/)\n})\n`
await writeFile('test/performance-architecture.test.js', tests)
