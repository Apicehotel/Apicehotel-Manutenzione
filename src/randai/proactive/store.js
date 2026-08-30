const clone = (value) => structuredClone(value)

export class ProactiveSignalStore {
  constructor(){ this.items = new Map() }
  async save(item){ this.items.set(item.id, clone(item)); return clone(item) }
  async get(id){ const item=this.items.get(id); return item?clone(item):null }
  async findOpenByFingerprint(projectId,fingerprint){ return [...this.items.values()].find(x=>x.projectId===projectId&&x.fingerprint===fingerprint&&!['RESOLVED','SUPPRESSED'].includes(x.status)) ? clone([...this.items.values()].find(x=>x.projectId===projectId&&x.fingerprint===fingerprint&&!['RESOLVED','SUPPRESSED'].includes(x.status))) : null }
  async list(filters={}){ return [...this.items.values()].filter(x=>!filters.projectId||x.projectId===filters.projectId).filter(x=>!filters.status||x.status===filters.status).map(clone) }
}

export class SupabaseProactiveSignalStore {
  constructor({supabase}={}){ if(!supabase?.from) throw new TypeError('SupabaseProactiveSignalStore requires a Supabase client'); this.supabase=supabase }
  async save(item){ const {error}=await this.supabase.from('randai_proactive_signals').upsert({id:item.id,project_id:item.projectId,type:item.type,fingerprint:item.fingerprint,severity:item.severity,status:item.status,count:item.count||1,signal:clone(item),updated_at:item.updatedAt,resolved_at:item.resolvedAt||null},{onConflict:'id'}); if(error) throw error; return clone(item) }
  async get(id){ const {data,error}=await this.supabase.from('randai_proactive_signals').select('signal').eq('id',id).maybeSingle(); if(error) throw error; return data?.signal?clone(data.signal):null }
  async findOpenByFingerprint(projectId,fingerprint){ const {data,error}=await this.supabase.from('randai_proactive_signals').select('signal').eq('project_id',projectId).eq('fingerprint',fingerprint).not('status','in','(RESOLVED,SUPPRESSED)').order('updated_at',{ascending:false}).limit(1).maybeSingle(); if(error) throw error; return data?.signal?clone(data.signal):null }
  async list(filters={}){ let q=this.supabase.from('randai_proactive_signals').select('signal'); if(filters.projectId) q=q.eq('project_id',filters.projectId); if(filters.status) q=q.eq('status',filters.status); const {data,error}=await q.order('updated_at',{ascending:false}); if(error) throw error; return (data||[]).map(r=>clone(r.signal)) }
}
