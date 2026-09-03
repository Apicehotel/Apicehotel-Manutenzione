import fs from 'node:fs/promises'
import path from 'node:path'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'

const token=process.env.GITHUB_TOKEN||''
const headers={Accept:'application/vnd.github+json','User-Agent':'Rand-Repo-Radar/1.0',...(token?{Authorization:`Bearer ${token}`}:{})}
const now=Date.now()
const staleMs=180*24*60*60*1000
const SEARCH_QUERIES=[
  'AI agent framework language:TypeScript stars:>1000 archived:false',
  'RAG retrieval augmented generation stars:>1000 archived:false',
  'MCP security model context protocol stars:>50 archived:false',
  'LLM eval red team stars:>500 archived:false',
]

async function githubJson(url){
  const response=await fetch(url,{headers})
  if(!response.ok) throw new Error(`GitHub ${response.status}`)
  return response.json()
}

function maintenanceScore(pushedAt){
  if(!pushedAt) return 0
  const age=Math.max(0,now-Date.parse(pushedAt))
  if(age<=30*86400000) return .95
  if(age<=90*86400000) return .82
  if(age<=staleMs) return .65
  return .25
}

async function enrich(candidate){
  const match=candidate.repository.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/)
  if(!match) return candidate
  const [,owner,repo]=match
  try{
    const data=await githubJson(`https://api.github.com/repos/${owner}/${repo}`)
    const pushedAt=data.pushed_at||null
    const maintained=!data.archived&&Boolean(pushedAt)&&(now-Date.parse(pushedAt))<=staleMs
    return {...candidate,stars:Number(data.stargazers_count||0),archived:Boolean(data.archived),maintained,license:data.license?.spdx_id||candidate.license||null,evaluatedAt:new Date().toISOString(),github:{pushedAt,openIssues:Number(data.open_issues_count||0),forks:Number(data.forks_count||0),defaultBranch:data.default_branch||null}}
  }catch(error){
    return {...candidate,evaluatedAt:new Date().toISOString(),github:{error:error?.message||String(error)}}
  }
}

function discoveredCandidate(data){
  const pushedAt=data.pushed_at||null
  return {
    id:`discovered:${data.full_name}`,
    name:data.full_name,
    repository:data.html_url,
    source:'DISCOVERED',
    license:data.license?.spdx_id||null,
    archived:Boolean(data.archived),
    maintained:!data.archived&&Boolean(pushedAt)&&(now-Date.parse(pushedAt))<=staleMs,
    stars:Number(data.stargazers_count||0),
    gates:{security:null,compatibility:null,benchmark:null,rollback:null},
    evidence:{security:.5,maintenance:maintenanceScore(pushedAt),maturity:Math.min(.9,.35+Math.log10(Math.max(1,Number(data.stargazers_count||0)))/10),tests:.5,compatibility:.5,performance:.5,rollback:.5,maintainability:.5},
    note:'WATCH automatico: scoperta GitHub non equivale ad approvazione; richiede deep review Rand prima di qualunque adozione.',
    evaluatedAt:new Date().toISOString(),
    github:{pushedAt,openIssues:Number(data.open_issues_count||0),forks:Number(data.forks_count||0),defaultBranch:data.default_branch||null},
  }
}

async function discover(){
  const known=new Set(REPO_RADAR_CATALOG.map((item)=>item.repository.toLowerCase().replace(/\/$/,'')))
  const found=new Map()
  for(const query of SEARCH_QUERIES){
    try{
      const data=await githubJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`)
      for(const repo of data.items||[]){
        const url=String(repo.html_url||'').toLowerCase().replace(/\/$/,'')
        if(!url||known.has(url)||found.has(url)) continue
        found.set(url,discoveredCandidate(repo))
      }
    }catch(error){
      console.warn(`Repo Radar discovery query failed: ${error?.message||error}`)
    }
  }
  return [...found.values()].slice(0,15)
}

const enriched=[]
for(const candidate of REPO_RADAR_CATALOG) enriched.push(await enrich(candidate))
const discovered=await discover()
const snapshot=buildRepoRadarSnapshot([...enriched,...discovered])
const outDir=path.resolve('artifacts/repo-radar')
await fs.mkdir(outDir,{recursive:true})
await fs.writeFile(path.join(outDir,'latest.json'),JSON.stringify({...snapshot,discovery:{queries:SEARCH_QUERIES.length,discovered:discovered.length}},null,2)+'\n')
console.log(`Repo Radar: ${snapshot.candidates.length} candidate (${discovered.length} discovered); `+Object.entries(snapshot.counts).map(([k,v])=>`${k}=${v}`).join(' '))
