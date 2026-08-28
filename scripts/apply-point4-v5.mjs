await import('./apply-point4-v4.mjs')
import { readFile, writeFile } from 'node:fs/promises'

const testPath = 'test/current-architecture.test.js'
let source = await readFile(testPath, 'utf8')
source = source.replace("  assert.match(shell, /operations\\/UtilityViews\\.jsx/)\n", "  assert.match(shell, /operations\\/UtilityLightViews\\.jsx/)\n  assert.doesNotMatch(shell, /operations\\/UtilityViews\\.jsx/)\n")
await writeFile(testPath, source)
