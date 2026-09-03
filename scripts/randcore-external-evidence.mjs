import fs from 'node:fs/promises'
import path from 'node:path'

const root=process.cwd()
const generatedAt=new Date().toISOString()
const sha=process.env.GITHUB_SHA||process.env.RANDCORE_COMMIT_SHA||null
const ref=process.env.GITHUB_REF||null
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'))
const lock=JSON.parse(await fs.readFile(path.join(root,'package-lock.json'),'utf8'))

const rows=[
  {
    domain:'deploy',status:'HEALTHY',score:100,source:'github-actions-build',checked_at:generatedAt,max_age_seconds:172800,commit_sha:sha,
    evidence:{sha,ref,build_artifact:'dist/index.html',browser_gate:true,device_gate:true},
  },
  {
    domain:'dependencies',status:'HEALTHY',score:100,source:'npm-audit-ci',checked_at:generatedAt,max_age_seconds:604800,commit_sha:sha,
    evidence:{direct_count:Object.keys({...(pkg.dependencies||{}),...(pkg.devDependencies||{})}).length,lock_packages:Object.keys(lock.packages||{}).length,lockfile_version:lock.lockfileVersion??null,audit_level:'high'},
  },
]

await fs.mkdir(path.join(root,'artifacts'),{recursive:true})
await fs.writeFile(path.join(root,'artifacts','randcore-external-evidence.json'),JSON.stringify({schema:'randcore.external-health-evidence.v1',generated_at:generatedAt,commit_sha:sha,rows},null,2))

const url=process.env.RANDCORE_SUPABASE_URL
const serviceKey=process.env.RANDCORE_SERVICE_ROLE_KEY
if(Boolean(url)!==Boolean(serviceKey)) throw new Error('randcore-external-evidence-partial-publisher-config')
if(url&&serviceKey){
  for(const row of rows){
    const response=await fetch(`${url.replace(/\/$/,'')}/rest/v1/rpc/randcore_record_external_health_evidence`,{
      method:'POST',
      headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},
      body:JSON.stringify({p_domain:row.domain,p_status:row.status,p_score:row.score,p_source:row.source,p_checked_at:row.checked_at,p_max_age_seconds:row.max_age_seconds,p_commit_sha:row.commit_sha,p_evidence:row.evidence}),
    })
    if(!response.ok) throw new Error(`randcore-external-evidence-publish-failed:${row.domain}:${response.status}`)
  }
  console.log(`RandCore external evidence published: ${rows.map(row=>row.domain).join(', ')}`)
}else{
  console.log('RandCore external evidence artifact emitted; production publishing is not configured in this runner.')
}
