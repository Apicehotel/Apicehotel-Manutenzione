const clone = (value) => structuredClone(value)
const matchesScope = (item, { hotelId = null, global = false } = {}) => {
  const scopedHotel = String(hotelId || '').trim() || null
  if (scopedHotel) return item.hotelId === scopedHotel
  if (global) return item.global === true && !item.hotelId
  return false
}

export class ProactiveSignalStore {
  constructor(){ this.items = new Map() }
  async save(item){ this.items.set(item.id, clone(item)); return clone(item) }
  async get(id, scope = null){ const item=this.items.get(id); if(!item) return null; if(scope && !matchesScope(item,scope)) return null; return clone(item) }
  async findOpenByFingerprint(projectId,fingerprint,scope){ const item=[...this.items.values()].find(x=>x.projectId===projectId&&x.fingerprint===fingerprint&&matchesScope(x,scope)&&!['RESOLVED','SUPPRESSED'].includes(x.status)); return item?clone(item):null }
  async list(filters={}){ return [...this.items.values()].filter(x=>!filters.projectId||x.projectId===filters.projectId).filter(x=>!filters.status||x.status===filters.status).filter(x=>filters.hotelId?x.hotelId===filters.hotelId:filters.global?x.global===true&&!x.hotelId:true).map(clone) }
}

export class SupabaseProactiveSignalStore {
  constructor({supabase}={}){ if(!supabase?.from) throw new TypeError('SupabaseProactiveSignalStore requires a Supabase client'); this.supabase=supabase }
  async save(item){ const {error}=await this.supabase.from('randai_proactive_signals').upsert({id:item.id,project_id:item.projectId,type:item.type,fingerprint:item.fingerprint,severity:item.severity,status:item.status,count:item.count||1,signal:clone(item),updated_at:item.updatedAt,resolved_at:item.resolvedAt||null},{onConflict:'id'}); if(error) throw error; return clone(item) }
  async get(id, scope = null){ const {data,error}=await this.supabase.from('randai_proactive_signals').select('signal').eq('id',id).maybeSingle(); if(error) throw error; if(!data?.signal) return null; if(scope && !matchesScope(data.signal,scope)) return null; return clone(data.signal) }
  async findOpenByFingerprint(projectId,fingerprint,scope){ let q=this.supabase.from('randai_proactive_signals').select('signal').eq('project_id',projectId).eq('fingerprint',fingerprint).not('status','in','(RESOLVED,SUPPRESSED)'); if(scope?.hotelId) q=q.contains('signal',{hotelId:scope.hotelId}); else if(scope?.global) q=q.contains('signal',{global:true}); else return null; const {data,error}=await q.order('updated_at',{ascending:false}).limit(1).maybeSingle(); if(error) throw error; return data?.signal?clone(data.signal):null }
  async list(filters={}){ let q=this.supabase.from('randai_proactive_signals').select('signal'); if(filters.projectId) q=q.eq('project_id',filters.projectId); if(filters.status) q=q.eq('status',filters.status); if(filters.hotelId) q=q.contains('signal',{hotelId:filters.hotelId}); else if(filters.global) q=q.contains('signal',{global:true}); const {data,error}=await q.order('updated_at',{ascending:false}); if(error) throw error; return (data||[]).map(r=>clone(r.signal)).filter(item=>!filters.hotelId||item.hotelId===filters.hotelId).filter(item=>!filters.global||item.global===true&&!item.hotelId) }
}
