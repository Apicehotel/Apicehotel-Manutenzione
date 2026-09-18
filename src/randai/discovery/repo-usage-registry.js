export const RepositoryUsageKind = Object.freeze({
  RUNTIME_DEPENDENCY: 'runtime_dependency',
  BUILD_TOOL: 'build_tool',
  CI_TOOL: 'ci_tool',
  GITHUB_ACTION: 'github_action',
})

export const RepositoryAdoptionMode = Object.freeze({
  FULL: 'full',
  PARTIAL: 'partial',
  CONCEPT: 'concept',
  TOOLING: 'tooling',
  REFERENCE_ONLY: 'reference_only',
})

export const RAND_USED_REPOSITORIES = Object.freeze([
  { id:'react', name:'React', repository:'https://github.com/facebook/react', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['react','react-dom'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'supabase-js', name:'Supabase JavaScript Client', repository:'https://github.com/supabase/supabase-js', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['@supabase/supabase-js'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'sentry-javascript', name:'Sentry JavaScript', repository:'https://github.com/getsentry/sentry-javascript', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['@sentry/react'], source:'package.json', adoption:RepositoryAdoptionMode.PARTIAL, randTargets:['RandApp','RandCore','RandOps'], watch:true },
  { id:'opentelemetry-js', name:'OpenTelemetry JS', repository:'https://github.com/open-telemetry/opentelemetry-js', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['@opentelemetry/api','@opentelemetry/sdk-trace-web','@opentelemetry/exporter-trace-otlp-http'], source:'package.json', adoption:RepositoryAdoptionMode.PARTIAL, randTargets:['RandAI','RandGateway','RandMCP'], watch:true },
  { id:'mcp-typescript-sdk', name:'MCP TypeScript SDK', repository:'https://github.com/modelcontextprotocol/typescript-sdk', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['@modelcontextprotocol/sdk'], source:'package.json', adoption:RepositoryAdoptionMode.PARTIAL, randTargets:['RandMCP','RandGateway','RandAI'], watch:true },
  { id:'tanstack-query', name:'TanStack Query', repository:'https://github.com/TanStack/query', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['@tanstack/react-query'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'dexie', name:'Dexie.js', repository:'https://github.com/dexie/Dexie.js', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['dexie'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'zod', name:'Zod', repository:'https://github.com/colinhacks/zod', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['zod'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'sheetjs', name:'SheetJS', repository:'https://github.com/SheetJS/sheetjs', kind:RepositoryUsageKind.RUNTIME_DEPENDENCY, packages:['xlsx'], source:'package.json (SheetJS CDN tarball)', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },

  { id:'vite', name:'Vite', repository:'https://github.com/vitejs/vite', kind:RepositoryUsageKind.BUILD_TOOL, packages:['vite'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'vite-plugin-react', name:'Vite React Plugin', repository:'https://github.com/vitejs/vite-plugin-react', kind:RepositoryUsageKind.BUILD_TOOL, packages:['@vitejs/plugin-react'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'playwright', name:'Playwright', repository:'https://github.com/microsoft/playwright', kind:RepositoryUsageKind.CI_TOOL, packages:['playwright'], source:'package.json', adoption:RepositoryAdoptionMode.FULL, randTargets:['RandApp'], watch:true },
  { id:'promptfoo', name:'Promptfoo', repository:'https://github.com/promptfoo/promptfoo', kind:RepositoryUsageKind.CI_TOOL, packages:['promptfoo@0.122.2'], source:'package.json script eval:randai:security', adoption:RepositoryAdoptionMode.TOOLING, randTargets:['RandSecure','RandTest'], watch:true },

  { id:'actions-checkout', name:'GitHub Checkout Action', repository:'https://github.com/actions/checkout', kind:RepositoryUsageKind.GITHUB_ACTION, packages:['actions/checkout@v4'], source:'.github/workflows', adoption:RepositoryAdoptionMode.TOOLING, randTargets:['RandOps','RandTest'], watch:true },
  { id:'actions-setup-node', name:'GitHub Setup Node Action', repository:'https://github.com/actions/setup-node', kind:RepositoryUsageKind.GITHUB_ACTION, packages:['actions/setup-node@v4'], source:'.github/workflows', adoption:RepositoryAdoptionMode.TOOLING, randTargets:['RandOps','RandTest'], watch:true },
  { id:'actions-upload-artifact', name:'GitHub Upload Artifact Action', repository:'https://github.com/actions/upload-artifact', kind:RepositoryUsageKind.GITHUB_ACTION, packages:['actions/upload-artifact@v4'], source:'.github/workflows', adoption:RepositoryAdoptionMode.TOOLING, randTargets:['RandOps','RandTest'], watch:true },
  { id:'digitalocean-app-action', name:'DigitalOcean App Platform Deploy Action', repository:'https://github.com/digitalocean/app_action', kind:RepositoryUsageKind.GITHUB_ACTION, packages:['digitalocean/app_action/deploy@v2'], source:'.github/workflows/digitalocean-preview.yml', adoption:RepositoryAdoptionMode.TOOLING, randTargets:['RandOps','RandUI'], watch:true },
])

export function getUsedRepository(id){
  return RAND_USED_REPOSITORIES.find((item)=>item.id===id)||null
}

export function listWatchedRepositories(){
  return RAND_USED_REPOSITORIES.filter((item)=>item.watch)
}
