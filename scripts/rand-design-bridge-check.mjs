import fs from 'node:fs'
import path from 'node:path'
import { assertRandDesignBridge, RANDDESIGN_CONTRACT, RANDDESIGN_TOOLS, summarizeRandDesignBridge } from '../src/randai/design/rand-design-bridge.js'

const REQUIRED_FILES=[
  'src/randapp/ui.jsx',
  'src/randapp/randui/design-contract.js',
  'src/randapp/randui/component-registry.js',
  'src/randapp/randui/foundation.css',
  'src/randapp/randui/guard.js',
  'test/randui-visual-language-v1.test.js',
  'test/e2e.mjs',
]

assertRandDesignBridge()

const missing=REQUIRED_FILES.filter((file)=>!fs.existsSync(path.resolve(file)))
if(missing.length) throw new Error(`RandDesignBridge missing canonical RandUI evidence: ${missing.join(', ')}`)

const summary=summarizeRandDesignBridge()
const report={
  generatedAt:new Date().toISOString(),
  contract:RANDDESIGN_CONTRACT,
  summary,
  canonicalEvidence:REQUIRED_FILES,
  tools:RANDDESIGN_TOOLS,
  readiness:{
    codeDesignSystem:'READY',
    externalFigmaBridge:'CONFIGURATION_DEPENDENT',
    codeConnect:'DEFERRED_UNTIL_ELIGIBLE_FIGMA_PLAN_AND_LIBRARY',
    visualRegression:'READY_WITH_EXISTING_PLAYWRIGHT_GATES',
    storybook:'NOT_REQUIRED',
  },
}

const outDir=path.resolve('artifacts/randdesign')
fs.mkdirSync(outDir,{recursive:true})
fs.writeFileSync(path.join(outDir,'latest.json'),JSON.stringify(report,null,2)+'\n')
console.log(`RandDesignBridge ${summary.version}: ${summary.toolCount} tools governed; RandUI evidence OK; Storybook not required.`)
