import fs from 'node:fs/promises'
import path from 'node:path'
import { REPO_RADAR_CATALOG } from '../src/randai/discovery/repo-radar-catalog.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'

const token = process.env.GITHUB_TOKEN || ''
const headers = { Accept:'application/vnd.github+json', 'User-Agent':'Rand-Repo-Radar/1.0', ...(token ? { Authorization:`Bearer ${token}` } : {}) }
const now = Date.now()
const staleMs = 180 * 24 * 60 * 60 * 1000

async function enrich(candidate){
  const match = candidate.repository.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/)
  if(!match) return candidate
  const [,owner,repo] = match
  try{
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers })
    if(!response.ok) throw new Error(`GitHub ${response.status}`)
    const data = await response.json()
    const pushedAt = data.pushed_at ? Date.parse(data.pushed_at) : 0
    const maintained = !data.archived && pushedAt > 0 && (now - pushedAt) <= staleMs
    return {
      ...candidate,
      stars:Number(data.stargazers_count || 0),
      archived:Boolean(data.archived),
      maintained,
      license:data.license?.spdx_id || candidate.license || null,
      evaluatedAt:new Date().toISOString(),
      github:{ pushedAt:data.pushed_at || null, openIssues:Number(data.open_issues_count || 0), forks:Number(data.forks_count || 0), defaultBranch:data.default_branch || null },
    }
  }catch(error){
    return { ...candidate, evaluatedAt:new Date().toISOString(), github:{ error:error?.message || String(error) } }
  }
}

const enriched = []
for(const candidate of REPO_RADAR_CATALOG) enriched.push(await enrich(candidate))
const snapshot = buildRepoRadarSnapshot(enriched)
const outDir = path.resolve('artifacts/repo-radar')
await fs.mkdir(outDir,{recursive:true})
await fs.writeFile(path.join(outDir,'latest.json'), JSON.stringify(snapshot,null,2)+'\n')
console.log(`Repo Radar: ${snapshot.candidates.length} candidate; ` + Object.entries(snapshot.counts).map(([k,v])=>`${k}=${v}`).join(' '))
