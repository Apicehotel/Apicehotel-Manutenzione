import fs from 'node:fs/promises'
import path from 'node:path'
import { getRandEcosystemManifest, summarizeRandEcosystem } from '../src/randai/core/ecosystem.js'
import { buildRepoRadarSnapshot } from '../src/randai/discovery/repo-radar.js'
import { REPO_RADAR_CANDIDATES } from '../src/randai/discovery/repo-radar-catalog.js'

const root=process.cwd()
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'))
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'))
const ecosystem=getRandEcosystemManifest()
const summary=summarizeRandEcosystem(ecosystem)
const radar=buildRepoRadarSnapshot(REPO_RADAR_CANDIDATES)
const directDeps={...(pkg.dependencies||{}),...(pkg.devDependencies||{})}
const lockPackages=Object.keys(lock.packages||{}).length

const findings=[]
if(summary.counts.ZOMBIE>0)findings.push({category:'ecosystem',severity:'WARN',code:'DECLARED_ZOMBIES',title:'Moduli zombie dichiarati',detail:`${summary.counts.ZOMBIE} moduli richiedono pulizia o decisione.`,fingerprint:'ecosystem:zombies'})
if(summary.unfinished>0)findings.push({category:'ecosystem',severity:'INFO',code:'UNFINISHED_MODULES',title:'Moduli ancora da consolidare',detail:`${summary.unfinished} moduli non sono LIVE.`,fingerprint:'ecosystem:unfinished'})
if(radar.counts.REJECT>0)findings.push({category:'repo-radar',severity:'INFO',code:'REJECTED_CANDIDATES',title:'Candidate respinte dal Repo Radar',detail:`${radar.counts.REJECT} candidate restano escluse.`,fingerprint:'repo-radar:rejected'})

const snapshot={
  version:1,
  generated_at:new Date().toISOString(),
  coverage:{measured_domains:4,total_domains:7},
  domains:{
    ecosystem:{state:'MEASURED',summary},
    dependencies:{state:'MEASURED',direct_count:Object.keys(directDeps).length,lock_packages:lockPackages},
    repo_radar:{state:'MEASURED',counts:radar.counts},
    source_control:{state:'MEASURED',sha:process.env.GITHUB_SHA||null,ref:process.env.GITHUB_REF||null},
    database:{state:'EXTERNAL'},workers:{state:'EXTERNAL'},backup_restore:{state:'UNKNOWN'}
  }
}
const score=Math.max(0,100-findings.reduce((n,f)=>n+(f.severity==='CRITICAL'?30:f.severity==='HIGH'?15:f.severity==='WARN'?7:0),0))
const status=findings.some((f)=>f.severity==='CRITICAL')?'CRITICAL':findings.some((f)=>['HIGH','WARN'].includes(f.severity))?'DEGRADED':'HEALTHY'
const report={status,score,snapshot,findings}
await fs.mkdir(path.join(root,'artifacts'),{recursive:true})
await fs.writeFile(path.join(root,'artifacts','randcore-full-check.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify({status,score,findings:findings.length,ecosystem:summary,dependencies:Object.keys(directDeps).length},null,2))
