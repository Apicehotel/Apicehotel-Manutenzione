import fs from 'node:fs/promises'
import path from 'node:path'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'

const token=process.env.GITHUB_TOKEN||''
const now=Date.now()
const staleMs=180*24*60*60*1000
const requestHeaders={'User-Agent':'Rand-Repo-Radar/2.3'}
const githubHeaders={...requestHeaders,Accept:'application/vnd.github+json',...(token?{Authorization:`Bearer ${token}`}:{})}
const MAX_DISCOVERED=80
const MAX_PER_SECTOR=2
const RANDUI_COVERAGE_CONTRACT='RANDUI_100_V1'
const RAND_STACK_TERMS=['react','typescript','next','next.js','vite','shadcn','tailwind','storybook','playwright','supabase','zod']

const CORE_SEARCH_PROFILES=[
  {id:'ai-agent',category:'AI_RUNTIME',sector:'AI_AGENT',priority:.78,query:'AI agent framework TypeScript',github:'AI agent framework language:TypeScript stars:>1000 archived:false'},
  {id:'rag',category:'KNOWLEDGE',sector:'RAG',priority:.75,query:'RAG retrieval augmented generation',github:'RAG retrieval augmented generation stars:>1000 archived:false'},
  {id:'mcp-security',category:'SECURITY',sector:'MCP_SECURITY',priority:.82,query:'MCP security model context protocol',github:'MCP security model context protocol stars:>50 archived:false'},
  {id:'llm-eval',category:'QUALITY',sector:'LLM_EVAL',priority:.82,query:'LLM eval red team',github:'LLM eval red team stars:>500 archived:false'},
]

const RANDUI_SECTORS=[
  {id:'FOUNDATION_LAYOUT',priority:.98,query:'responsive web app layout grid spacing design tokens css'},
  {id:'SHELL_NAVIGATION',priority:.99,query:'react app shell sidebar topbar bottom navigation responsive'},
  {id:'PAGE_TEMPLATES',priority:.99,query:'react admin page templates dashboard list detail settings responsive'},
  {id:'DASHBOARD_KPI',priority:.94,query:'react dashboard kpi cards widgets responsive design system'},
  {id:'DATA_TABLES',priority:.97,query:'react data table data grid filter sort pagination responsive'},
  {id:'MASTER_DETAIL',priority:.97,query:'react master detail list detail split pane responsive'},
  {id:'MOBILE_OPERATIONAL',priority:.99,query:'react mobile first operational dashboard touch bottom navigation offline'},
  {id:'PLANNING_CALENDAR',priority:.95,query:'react planning calendar scheduler timeline resource booking'},
  {id:'FORMS_WIZARDS',priority:.97,query:'react form wizard schema validation autosave conditional fields'},
  {id:'SETTINGS_ADMIN_RBAC',priority:.96,query:'react settings admin permissions rbac user management ui'},
  {id:'AUTH_ONBOARDING',priority:.97,query:'react authentication onboarding login session expired recovery access denied ui'},
  {id:'THEME_DENSITY',priority:.95,query:'react theme dark light density personalization contrast design tokens'},
  {id:'LOCALIZATION_I18N',priority:.92,query:'react internationalization i18n locale rtl dates numbers accessibility ui'},
  {id:'SYSTEM_STATES',priority:1,query:'react empty state loading skeleton error retry stale degraded feedback ui'},
  {id:'SEARCH_COMMAND',priority:.93,query:'react command palette global search autocomplete filter ui'},
  {id:'NOTIFICATIONS_ACTIVITY',priority:.95,query:'react toast notification activity feed alert center ui'},
  {id:'OFFLINE_SYNC',priority:.98,query:'react offline queue sync retry conflict stale network state'},
  {id:'REALTIME_COLLAB',priority:.95,query:'react realtime collaboration presence optimistic updates conflict resolution ui'},
  {id:'PWA_UPDATE',priority:.96,query:'react pwa service worker update available install offline cache ui'},
  {id:'MEDIA_FILES',priority:.94,query:'react file upload preview drag drop progress retry image video document ui'},
  {id:'RICH_CONTENT_EDITOR',priority:.93,query:'react rich text editor structured content tiptap lexical editor ui'},
  {id:'PERFORMANCE_VIRTUALIZATION',priority:.97,query:'react virtualization large lists tables grids performance virtual scroll'},
  {id:'DATA_VISUALIZATION',priority:.94,query:'react charts data visualization dashboard accessible responsive'},
  {id:'MAPS_LOCATION',priority:.82,query:'react map location geolocation markers responsive accessible ui'},
  {id:'DRAG_DROP_REORDER',priority:.9,query:'react drag drop sortable reorder kanban scheduler accessible'},
  {id:'TOUCH_GESTURES',priority:.94,query:'react touch gestures swipe long press drag mobile accessibility'},
  {id:'MOTION_TRANSITIONS',priority:.78,query:'react motion transitions reduced motion accessibility micro interaction'},
  {id:'DESIGN_SYSTEM',priority:1,query:'react design system component library tokens storybook accessibility'},
  {id:'ACCESSIBILITY',priority:1,query:'react accessibility aria wcag keyboard screen reader components'},
  {id:'SCHEMA_UI',priority:1,query:'react schema driven ui renderer component registry template registry'},
  {id:'VISUAL_BUILDER',priority:.92,query:'react visual page builder component registry drag drop editor'},
  {id:'VISUAL_TESTING',priority:1,query:'playwright visual regression responsive layout screenshot testing'},
  {id:'DOCS_GOVERNANCE',priority:.96,query:'react storybook component documentation design system governance visual catalog'},
  {id:'ASSETS_ICONS',priority:.85,query:'react icon system asset manager logo image component library'},
  {id:'PRINT_EXPORT',priority:.88,query:'react print layout export pdf responsive report template'},
]

const UI_SEARCH_PROFILES=RANDUI_SECTORS.map((sector)=>({
  id:`ui-${sector.id.toLowerCase().replaceAll('_','-')}`,
  category:'RANDUI',
  sector:sector.id,
  priority:sector.priority,
  query:sector.query,
  github:`${sector.query} archived:false`,
}))

const SEARCH_PROFILES=[...CORE_SEARCH_PROFILES,...UI_SEARCH_PROFILES]

const PROVIDERS=[
  {id:'GITHUB',search:discoverGitHub},
  {id:'GITLAB',search:discoverGitLab},
  {id:'CODEBERG',search:discoverCodeberg},
  {id:'NPM',search:discoverNpm},
]

async function requestJson(url,{headers=requestHeaders}={}){
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(8000)})
  if(!response.ok) throw new Error(`${new URL(url).hostname} ${response.status}`)
  return response.json()
}

function maintenanceScore(pushedAt){
  if(!pushedAt) return .35
  const age=Math.max(0,now-Date.parse(pushedAt))
  if(age<=30*86400000) return .95
  if(age<=90*86400000) return .82
  if(age<=staleMs) return .65
  return .25
}

function normalizeRepositoryUrl(raw){
  let value=String(raw||'').trim().replace(/^git\+/,'').replace(/^git:\/\//,'https://')
  value=value.replace(/\.git(?:#.*)?$/,'').replace(/#.*$/,'')
  if(/^git@github\.com:/i.test(value)) value=value.replace(/^git@github\.com:/i,'https://github.com/')
  if(/^git@gitlab\.com:/i.test(value)) value=value.replace(/^git@gitlab\.com:/i,'https://gitlab.com/')
  try{
    const url=new URL(value)
    if(url.protocol!=='https:') return null
    url.hash=''
    url.search=''
    url.pathname=url.pathname.replace(/\/+$/,'')
    return url.toString().replace(/\/$/,'')
  }catch{return null}
}

function canonicalUrl(raw){
  return String(normalizeRepositoryUrl(raw)||'').toLowerCase().replace(/\/$/,'')
}

function stackCompatibility(meta){
  const haystack=[meta.name,meta.description,meta.language,...(meta.topics||[])].filter(Boolean).join(' ').toLowerCase()
  const hits=RAND_STACK_TERMS.filter((term)=>haystack.includes(term)).length
  return Math.min(.95,.55+hits*.08)
}

function discoveryScore(meta,profile){
  const freshness=maintenanceScore(meta.pushedAt)
  const stack=stackCompatibility(meta)
  const popularity=Math.min(1,Math.log10(Math.max(1,Number(meta.stars||0)+1))/5)
  const licenseSignal=meta.license ? .85 : .35
  const archivedPenalty=meta.archived ? .35 : 1
  return Number(((profile.priority*.42+freshness*.28+stack*.2+popularity*.07+licenseSignal*.03)*archivedPenalty).toFixed(4))
}

function metaCandidate(meta,profile){
  const pushedAt=meta.pushedAt||null
  const technicalCompatibility=stackCompatibility(meta)
  return {
    id:`discovered:${meta.platform.toLowerCase()}:${meta.fullName}`,
    name:meta.fullName,
    repository:meta.repository,
    source:'DISCOVERED',
    sourcePlatform:meta.platform,
    category:profile.category,
    sector:profile.sector,
    capability:profile.id,
    discoveryScore:discoveryScore(meta,profile),
    license:meta.license||null,
    archived:Boolean(meta.archived),
    maintained:!meta.archived&&Boolean(pushedAt)&&(now-Date.parse(pushedAt))<=staleMs,
    stars:Number(meta.stars||0),
    gates:{security:null,compatibility:null,benchmark:null,rollback:null},
    evidence:{security:.5,maintenance:maintenanceScore(pushedAt),maturity:.55,tests:.5,compatibility:technicalCompatibility,performance:.5,rollback:.5,maintainability:.55},
    note:`WATCH automatico ${meta.platform}/${profile.sector}: discovery non equivale ad approvazione; deep review Rand obbligatoria prima di qualunque adozione.`,
    evaluatedAt:new Date().toISOString(),
    discovery:{profile:profile.id,category:profile.category,sector:profile.sector,platform:meta.platform,score:discoveryScore(meta,profile),description:meta.description||null},
    repositoryMeta:{pushedAt,openIssues:Number(meta.openIssues||0),forks:Number(meta.forks||0),defaultBranch:meta.defaultBranch||null,language:meta.language||null,topics:meta.topics||[]},
  }
}

async function discoverGitHub(profile){
  const data=await requestJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(profile.github||profile.query)}&sort=stars&order=desc&per_page=4`,{headers:githubHeaders})
  return (data.items||[]).map((repo)=>({
    platform:'GITHUB',fullName:repo.full_name,repository:repo.html_url,description:repo.description,pushedAt:repo.pushed_at,
    stars:repo.stargazers_count,archived:repo.archived,license:repo.license?.spdx_id||null,openIssues:repo.open_issues_count,
    forks:repo.forks_count,defaultBranch:repo.default_branch,language:repo.language,topics:repo.topics||[],
  }))
}

async function discoverGitLab(profile){
  const data=await requestJson(`https://gitlab.com/api/v4/projects?search=${encodeURIComponent(profile.query)}&order_by=star_count&sort=desc&simple=true&per_page=4`)
  return (Array.isArray(data)?data:[]).map((repo)=>({
    platform:'GITLAB',fullName:repo.path_with_namespace||repo.name_with_namespace||repo.name,repository:repo.web_url,
    description:repo.description,pushedAt:repo.last_activity_at,stars:repo.star_count,archived:repo.archived,license:null,
    openIssues:0,forks:repo.forks_count,defaultBranch:repo.default_branch,language:null,topics:repo.topics||repo.tag_list||[],
  }))
}

async function discoverCodeberg(profile){
  const data=await requestJson(`https://codeberg.org/api/v1/repos/search?q=${encodeURIComponent(profile.query)}&limit=4&sort=stars&order=desc`)
  const items=Array.isArray(data)?data:(data.data||[])
  return items.map((repo)=>({
    platform:'CODEBERG',fullName:repo.full_name||`${repo.owner?.login||'codeberg'}/${repo.name}`,repository:repo.html_url,
    description:repo.description,pushedAt:repo.updated_at,stars:repo.stars_count,archived:repo.archived,license:typeof repo.license==='string'?repo.license:repo.license?.spdx_id||null,
    openIssues:repo.open_issues_count,forks:repo.forks_count,defaultBranch:repo.default_branch,language:repo.language,topics:repo.topics||[],
  }))
}

async function discoverNpm(profile){
  const data=await requestJson(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(profile.query)}&size=4`)
  const items=[]
  for(const entry of data.objects||[]){
    const pkg=entry.package||{}
    const repository=normalizeRepositoryUrl(pkg.links?.repository)
    if(!repository) continue
    items.push({
      platform:'NPM',fullName:pkg.name||repository,repository,description:pkg.description,pushedAt:entry.updated,
      stars:0,archived:false,license:pkg.license||null,openIssues:0,forks:0,defaultBranch:null,language:'JavaScript/TypeScript',topics:pkg.keywords||[],
    })
  }
  return items
}

async function enrich(candidate){
  const match=candidate.repository.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/)
  if(!match) return candidate
  const [,owner,repo]=match
  try{
    const data=await requestJson(`https://api.github.com/repos/${owner}/${repo}`,{headers:githubHeaders})
    const pushedAt=data.pushed_at||null
    const maintained=!data.archived&&Boolean(pushedAt)&&(now-Date.parse(pushedAt))<=staleMs
    return {...candidate,stars:Number(data.stargazers_count||0),archived:Boolean(data.archived),maintained,license:data.license?.spdx_id||candidate.license||null,evaluatedAt:new Date().toISOString(),repositoryMeta:{pushedAt,openIssues:Number(data.open_issues_count||0),forks:Number(data.forks_count||0),defaultBranch:data.default_branch||null,language:data.language||null,topics:data.topics||[]}}
  }catch(error){
    return {...candidate,evaluatedAt:new Date().toISOString(),repositoryMeta:{error:error?.message||String(error)}}
  }
}

function boundedSelection(found){
  const ordered=[...found.values()].sort((a,b)=>b.discoveryScore-a.discoveryScore||a.name.localeCompare(b.name))
  const buckets=new Map()
  for(const candidate of ordered){
    const key=candidate.sector||candidate.category||'OTHER'
    if(!buckets.has(key)) buckets.set(key,[])
    buckets.get(key).push(candidate)
  }
  const selected=[]
  const selectedUrls=new Set()
  for(const items of buckets.values()){
    const candidate=items[0]
    if(!candidate||selected.length>=MAX_DISCOVERED) continue
    selected.push(candidate)
    selectedUrls.add(canonicalUrl(candidate.repository))
  }
  for(const candidate of ordered){
    if(selected.length>=MAX_DISCOVERED) break
    const url=canonicalUrl(candidate.repository)
    if(selectedUrls.has(url)) continue
    const key=candidate.sector||candidate.category||'OTHER'
    const count=selected.filter((item)=>(item.sector||item.category||'OTHER')===key).length
    if(count>=MAX_PER_SECTOR) continue
    selected.push(candidate)
    selectedUrls.add(url)
  }
  return selected.sort((a,b)=>b.discoveryScore-a.discoveryScore||a.name.localeCompare(b.name))
}

async function discover(){
  const known=new Set(REPO_RADAR_CATALOG.map((item)=>canonicalUrl(item.repository)))
  const found=new Map()
  const providerStats=Object.fromEntries(PROVIDERS.map((provider)=>[provider.id,{queries:0,results:0,errors:0}]))
  for(const profile of SEARCH_PROFILES){
    const settled=await Promise.allSettled(PROVIDERS.map(async(provider)=>{
      providerStats[provider.id].queries++
      const results=await provider.search(profile)
      providerStats[provider.id].results+=results.length
      return results
    }))
    settled.forEach((result,index)=>{
      const provider=PROVIDERS[index]
      if(result.status==='rejected'){
        providerStats[provider.id].errors++
        console.warn(`Repo Radar ${provider.id}/${profile.id} failed: ${result.reason?.message||result.reason}`)
        return
      }
      for(const meta of result.value){
        const url=canonicalUrl(meta.repository)
        if(!url||known.has(url)) continue
        const candidate=metaCandidate({...meta,repository:normalizeRepositoryUrl(meta.repository)},profile)
        const previous=found.get(url)
        if(!previous||candidate.discoveryScore>previous.discoveryScore) found.set(url,candidate)
      }
    })
  }
  return {candidates:boundedSelection(found),providerStats}
}

const enriched=[]
for(const candidate of REPO_RADAR_CATALOG) enriched.push(await enrich(candidate))
const {candidates:discovered,providerStats}=await discover()
const snapshot=buildRepoRadarSnapshot([...enriched,...discovered])
const sectorCoverage=Object.fromEntries(RANDUI_SECTORS.map((sector)=>[sector.id,discovered.filter((item)=>item.sector===sector.id).length]))
const coveredUiSectors=Object.values(sectorCoverage).filter((count)=>count>0).length
const outDir=path.resolve('artifacts/repo-radar')
await fs.mkdir(outDir,{recursive:true})
await fs.writeFile(path.join(outDir,'latest.json'),JSON.stringify({...snapshot,discovery:{coverageContract:RANDUI_COVERAGE_CONTRACT,profiles:SEARCH_PROFILES.length,uiSectors:RANDUI_SECTORS.map((item)=>item.id),uiSectorCount:RANDUI_SECTORS.length,coveredUiSectors,sectorCoverage,providers:PROVIDERS.map((item)=>item.id),providerStats,discovered:discovered.length,maxDiscovered:MAX_DISCOVERED,maxPerSector:MAX_PER_SECTOR}},null,2)+'\n')
console.log(`Repo Radar ${RANDUI_COVERAGE_CONTRACT}: ${snapshot.candidates.length} candidate (${discovered.length} discovered across ${PROVIDERS.length} providers / ${RANDUI_SECTORS.length} RandUI sectors, ${coveredUiSectors} with results); `+Object.entries(snapshot.counts).map(([k,v])=>`${k}=${v}`).join(' '))
