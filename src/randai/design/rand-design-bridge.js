export const RandDesignToolDecision = Object.freeze({
  PRIMARY: 'PRIMARY',
  ADOPT_PATTERN: 'ADOPT_PATTERN',
  SANDBOX_ONLY: 'SANDBOX_ONLY',
  DEFERRED: 'DEFERRED',
  REFERENCE_ONLY: 'REFERENCE_ONLY',
})

export const RANDDESIGN_CAPABILITIES = Object.freeze([
  'FIGMA_READ',
  'FIGMA_WRITE',
  'DESIGN_CONTEXT',
  'DESIGN_TOKEN_SYNC',
  'CODE_COMPONENT_MAPPING',
  'VISUAL_REGRESSION',
  'REVERSE_IMPORT',
  'SCREENSHOT_TO_LAYERS',
])

export const RANDDESIGN_TOOLS = Object.freeze([
  {
    id:'figma-official-mcp',
    name:'Figma MCP ufficiale',
    decision:RandDesignToolDecision.PRIMARY,
    capabilities:['FIGMA_READ','FIGMA_WRITE','DESIGN_CONTEXT'],
    runtimeBoundary:'EXTERNAL_CONNECTOR',
    reason:'Canale canonico Figma; nessun secondo owner del design system.',
  },
  {
    id:'framelink-figma-context-mcp',
    name:'Framelink / Figma Context MCP',
    decision:RandDesignToolDecision.ADOPT_PATTERN,
    capabilities:['FIGMA_READ','DESIGN_CONTEXT'],
    runtimeBoundary:'OPTIONAL_LOCAL_ADAPTER',
    reason:'Contesto Figma compresso per coding agent; adapter opzionale, non autorità.',
  },
  {
    id:'figma-code-connect',
    name:'Figma Code Connect',
    decision:RandDesignToolDecision.DEFERRED,
    capabilities:['CODE_COMPONENT_MAPPING','DESIGN_CONTEXT'],
    runtimeBoundary:'EXTERNAL_DESIGN_SERVICE',
    reason:'Utile quando il piano/seat Figma e una libreria componenti pubblicata soddisfano i requisiti; non blocca RandUI.',
  },
  {
    id:'tokens-studio',
    name:'Tokens Studio / Style Dictionary transforms',
    decision:RandDesignToolDecision.ADOPT_PATTERN,
    capabilities:['DESIGN_TOKEN_SYNC'],
    runtimeBoundary:'BUILD_TIME_PATTERN',
    reason:'Pattern DTCG/token sync; RandUI resta source of truth lato codice finché il sync bidirezionale non è verificato.',
  },
  {
    id:'figma-console-mcp',
    name:'figma-console-mcp',
    decision:RandDesignToolDecision.SANDBOX_ONLY,
    capabilities:['FIGMA_READ','FIGMA_WRITE','DESIGN_CONTEXT','DESIGN_TOKEN_SYNC'],
    runtimeBoundary:'SANDBOX',
    reason:'Capacità molto ampie e sovrapposte al MCP ufficiale; utile per benchmark, non come secondo control plane.',
  },
  {
    id:'image-to-figma-layers',
    name:'Image To Figma Layers',
    decision:RandDesignToolDecision.SANDBOX_ONLY,
    capabilities:['SCREENSHOT_TO_LAYERS','REVERSE_IMPORT'],
    runtimeBoundary:'SANDBOX',
    reason:'Utile per reverse design da screenshot; output sempre revisionato prima di diventare design canonico.',
  },
  {
    id:'storybook-figma-sync',
    name:'Storybook Figma Sync',
    decision:RandDesignToolDecision.DEFERRED,
    capabilities:['VISUAL_REGRESSION'],
    runtimeBoundary:'DEV_ONLY',
    reason:'Non si introduce Storybook soltanto per questo addon: RandUI usa già Playwright/visual gates. Si rivaluta se Storybook diventa canonico.',
  },
  {
    id:'figma-to-code',
    name:'FigmaToCode',
    decision:RandDesignToolDecision.REFERENCE_ONLY,
    capabilities:['DESIGN_CONTEXT'],
    runtimeBoundary:'DESIGN_TOOL',
    reason:'Scaffold utile ma non sostituisce component registry, token e review del codebase reale.',
  },
  {
    id:'builder-figma-html',
    name:'Builder.io figma-html',
    decision:RandDesignToolDecision.REFERENCE_ONLY,
    capabilities:['REVERSE_IMPORT'],
    runtimeBoundary:'DESIGN_TOOL',
    reason:'Pattern HTML/web→Figma; non si introduce Builder.io come dipendenza obbligatoria.',
  },
])

export const RANDDESIGN_CONTRACT = Object.freeze({
  version:'1.0.0',
  owner:'RandUI',
  bridge:'RandDesignBridge',
  principles:Object.freeze([
    'randui-remains-canonical-code-design-system',
    'no-second-navigation-theme-or-component-owner',
    'external-design-tools-have-no-production-authority',
    'design-generated-code-always-enters-a-feature-branch',
    'human-review-required-before-main',
    'visual-regression-prefers-existing-playwright-gates-until-storybook-is-canonical',
    'tokens-use-dtcg-compatible-shapes-when-exported',
    'reverse-import-output-is-never-canonical-without-review',
  ]),
})

export function summarizeRandDesignBridge(){
  const counts=Object.fromEntries(Object.values(RandDesignToolDecision).map((value)=>[value,0]))
  for(const tool of RANDDESIGN_TOOLS) counts[tool.decision]++
  return Object.freeze({ version:RANDDESIGN_CONTRACT.version, toolCount:RANDDESIGN_TOOLS.length, capabilities:[...RANDDESIGN_CAPABILITIES], counts })
}

export function assertRandDesignBridge(){
  const ids=new Set()
  for(const tool of RANDDESIGN_TOOLS){
    if(!tool.id||!tool.name||!Object.values(RandDesignToolDecision).includes(tool.decision)) throw new TypeError('Invalid RandDesign tool')
    if(ids.has(tool.id)) throw new TypeError(`Duplicate RandDesign tool: ${tool.id}`)
    ids.add(tool.id)
    if(!tool.capabilities?.length) throw new TypeError(`RandDesign tool without capabilities: ${tool.id}`)
    for(const capability of tool.capabilities) if(!RANDDESIGN_CAPABILITIES.includes(capability)) throw new TypeError(`Unknown RandDesign capability: ${capability}`)
  }
  const primary=RANDDESIGN_TOOLS.filter((tool)=>tool.decision===RandDesignToolDecision.PRIMARY)
  if(primary.length!==1||primary[0].id!=='figma-official-mcp') throw new Error('Figma official MCP must remain the single primary bridge')
  return true
}
