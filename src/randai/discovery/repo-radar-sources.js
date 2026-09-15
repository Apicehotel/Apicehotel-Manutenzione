export const REPO_RADAR_MIN_ECOSYSTEMS = 8

export const RepoRadarSourceMode = Object.freeze({
  AUTOMATED: 'AUTOMATED',
  MANUAL_DEEP_REVIEW: 'MANUAL_DEEP_REVIEW',
  OPTIONAL: 'OPTIONAL',
})

export const REPO_RADAR_SOURCE_CATALOG = Object.freeze([
  { id:'GITHUB', family:'CODE_FORGE', mode:RepoRadarSourceMode.AUTOMATED, url:'https://github.com' },
  { id:'GITLAB', family:'CODE_FORGE', mode:RepoRadarSourceMode.AUTOMATED, url:'https://gitlab.com' },
  { id:'CODEBERG', family:'CODE_FORGE', mode:RepoRadarSourceMode.AUTOMATED, url:'https://codeberg.org' },
  { id:'GITEE', family:'CODE_FORGE', mode:RepoRadarSourceMode.AUTOMATED, url:'https://gitee.com' },
  { id:'BITBUCKET', family:'CODE_FORGE', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://bitbucket.org' },
  { id:'GITCODE', family:'CODE_FORGE', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://gitcode.com' },
  { id:'SOURCEFORGE', family:'CODE_FORGE', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://sourceforge.net' },
  { id:'NPM', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.AUTOMATED, url:'https://www.npmjs.com' },
  { id:'CRATES', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.AUTOMATED, url:'https://crates.io' },
  { id:'PYPI', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://pypi.org' },
  { id:'PUBDEV', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://pub.dev' },
  { id:'MAVEN', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://central.sonatype.com' },
  { id:'NUGET', family:'PACKAGE_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://www.nuget.org' },
  { id:'HUGGINGFACE', family:'AI_HUB', mode:RepoRadarSourceMode.AUTOMATED, url:'https://huggingface.co' },
  { id:'OPENVSX', family:'IDE_MARKETPLACE', mode:RepoRadarSourceMode.AUTOMATED, url:'https://open-vsx.org' },
  { id:'VSCODE_MARKETPLACE', family:'IDE_MARKETPLACE', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://marketplace.visualstudio.com' },
  { id:'DOCKER_HUB', family:'CONTAINER_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://hub.docker.com' },
  { id:'FIGMA_COMMUNITY', family:'DESIGN_ECOSYSTEM', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://www.figma.com/community' },
  { id:'STORYBOOK', family:'DESIGN_ECOSYSTEM', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://storybook.js.org' },
  { id:'MCP_SO', family:'MCP_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://mcp.so' },
  { id:'GLAMA', family:'MCP_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://glama.ai/mcp/servers' },
  { id:'SMITHERY', family:'MCP_REGISTRY', mode:RepoRadarSourceMode.MANUAL_DEEP_REVIEW, url:'https://smithery.ai' },
  { id:'STACKBLITZ', family:'LIVE_CODE', mode:RepoRadarSourceMode.OPTIONAL, url:'https://stackblitz.com' },
  { id:'CODESANDBOX', family:'LIVE_CODE', mode:RepoRadarSourceMode.OPTIONAL, url:'https://codesandbox.io' },
  { id:'REPLIT', family:'LIVE_CODE', mode:RepoRadarSourceMode.OPTIONAL, url:'https://replit.com' },
])

export const FIGMA_DISCOVERY_FAMILIES = Object.freeze([
  'FIGMA_TO_CODE',
  'CODE_TO_FIGMA',
  'SCREENSHOT_TO_FIGMA',
  'MCP_AGENT_BRIDGE',
  'DESIGN_TOKEN_SYNC',
  'VARIABLES_COMPONENTS_CODEGEN',
  'STORYBOOK_FIGMA',
  'VISUAL_REGRESSION',
  'CROSS_FRAMEWORK_IMPLEMENTATION',
  'ACCESSIBILITY_DESIGN_LINT',
])

export function summarizeRepoRadarSourceCoverage(sources=REPO_RADAR_SOURCE_CATALOG){
  const active=sources.filter((source)=>source.mode!==RepoRadarSourceMode.OPTIONAL)
  const automated=active.filter((source)=>source.mode===RepoRadarSourceMode.AUTOMATED)
  const families=[...new Set(active.map((source)=>source.family))]
  return Object.freeze({
    sourceCount:active.length,
    automatedCount:automated.length,
    familyCount:families.length,
    families:Object.freeze(families),
    meetsMinimum:active.length>=REPO_RADAR_MIN_ECOSYSTEMS,
  })
}

export function assertRepoRadarSourcePolicy(sources=REPO_RADAR_SOURCE_CATALOG){
  const coverage=summarizeRepoRadarSourceCoverage(sources)
  if(!coverage.meetsMinimum) throw new Error(`Repo Radar requires at least ${REPO_RADAR_MIN_ECOSYSTEMS} source ecosystems`)
  if(coverage.automatedCount<8) throw new Error('Repo Radar requires at least eight automated discovery sources')
  if(coverage.familyCount<4) throw new Error('Repo Radar source coverage must span at least four source families')
  return true
}
