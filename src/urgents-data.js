import { supabase } from './supabase.js'
import { cacheRemoteCollection, enqueueMutation, findCachedHotelId, getCachedCollection, isTransientNetworkError, makeClientMutationId, makeOfflineId, registerOfflineHandler } from './offline-store.js'
import { operationFailed, operationSaved } from './operation-feedback.js'

const ENTITY='urgents'
const onlineNow=()=>typeof navigator==='undefined'||navigator.onLine
const same=(a,b)=>JSON.stringify(a??null)===JSON.stringify(b??null)
const statusToApp={aperta:'aperta',presa:'presa_in_carico',completata:'completata'}
const statusToDb={aperta:'aperta',presa_in_carico:'presa',completata:'completata'}

function fromRow(row){return{
  id:row.id,hotelId:row.hotel_id,note:row.nota,status:statusToApp[row.stato]||'aperta',
  severity:row.gravita||'urgente',location:row.posizione||null,department:row.reparto||null,photoPath:row.foto||null,
  createdBy:row.creato_da,createdAt:row.creato_il?new Date(row.creato_il).getTime():Date.now(),updatedAt:row.updated_at?new Date(row.updated_at).getTime():null,
  clientMutationId:row.mutation_id||null,takenBy:row.presa_in_carico_da||null,takenAt:row.presa_in_carico_il?new Date(row.presa_in_carico_il).getTime():null,
  completedBy:row.completata_da||null,completedAt:row.completata_il?new Date(row.completata_il).getTime():null,
  transformedIssueId:row.trasformata_in_segnalazione_id||null,transformed:!!row.trasformata_in_segnalazione_id,
}}
function toRow(item){const row={},set=(c,v)=>{if(v!==undefined)row[c]=v};set('hotel_id',item.hotelId);set('mutation_id',item.clientMutationId);set('nota',item.note);if(item.status!==undefined)row.stato=statusToDb[item.status]||'aperta';set('gravita',item.severity);set('posizione',item.location);set('reparto',item.department);set('foto',item.photoPath);set('creato_da',item.createdBy);set('presa_in_carico_da',item.takenBy);set('completata_da',item.completedBy);set('trasformata_in_segnalazione_id',item.transformedIssueId);if(item.status==='presa_in_carico')row.presa_in_carico_il=new Date().toISOString();if(item.status==='completata')row.completata_il=new Date().toISOString();return row}
async function withSyncBase(id,hotelId,changes){if(String(id).startsWith('offline-'))return changes;const cached=await getCachedCollection(ENTITY,hotelId),base=cached.find((item)=>item.id===id);if(!base?.updatedAt)return changes;const baseValues={};for(const key of Object.keys(changes))if(!key.startsWith('_')&&key!=='hotelId'&&key in base)baseValues[key]=base[key];return{...changes,_syncBaseUpdatedAt:base.updatedAt,_syncBaseValues:baseValues}}
function conflictError(fields){const error=new Error(`Conflitto di sincronizzazione: ${fields.join(', ')}`);error.code='OFFLINE_CONFLICT';error.conflictFields=fields;return error}
async function existingByMutation(mutationId){if(!mutationId)return null;const{data,error}=await supabase.from('richieste_urgenti').select('*').eq('mutation_id',mutationId).maybeSingle();if(error)throw error;return data||null}

function requestUrgentRefresh(hotelId){
  if(typeof window==='undefined'||!hotelId)return
  window.dispatchEvent(new CustomEvent('apice-offline-data-changed',{detail:{entity:ENTITY,hotelId,reason:'server-reconcile'}}))
}

async function resolveHotelId(id,preferredHotelId=null){
  if(preferredHotelId)return preferredHotelId
  const cached=await findCachedHotelId(ENTITY,id)
  if(cached)return cached
  if(!supabase||!onlineNow()||String(id).startsWith('offline-'))return null
  const{data,error}=await supabase.from('richieste_urgenti').select('hotel_id').eq('id',id).maybeSingle()
  if(error)throw error
  return data?.hotel_id||null
}

export async function notifyUrgent(hotelId,note,{severity='urgente',location=null,urgentId=null}={}){if(!supabase||!onlineNow())return;try{const prefix=severity==='emergenza'?'EMERGENZA':'Avviso urgente';const body=[location,note].filter(Boolean).join(' · ');const{data,error}=await supabase.functions.invoke('send-push',{body:{hotel_id:hotelId,event_type:'urgent',urgent_id:urgentId,title:prefix,body,severity,location}});if(error)console.error('notifyUrgent',error);else if(data&&data.ok===false)console.error('notifyUrgent',data.error)}catch(error){console.error('notifyUrgent',error)}}

async function dbInsert(item){const mutationId=item.clientMutationId||makeClientMutationId();let data=await existingByMutation(mutationId);if(!data){let result=await supabase.from('richieste_urgenti').insert(toRow({...item,clientMutationId:mutationId})).select().single();if(result.error?.code==='23505'&&mutationId){data=await existingByMutation(mutationId);result={data,error:null}}if(result.error)throw result.error;data=result.data}const created=fromRow(data);if(item._notifyOnSync)await notifyUrgent(created.hotelId,created.note,{severity:created.severity,location:created.location,urgentId:created.id});return created}
async function atomicTake(id,hotelId,name){
  if(!hotelId)throw new Error('Struttura dell’avviso non disponibile')
  const{data,error}=await supabase.rpc('prendi_urgente',{p_id:id,p_hotel_id:hotelId,p_nome:name})
  if(error)throw error
  const row=Array.isArray(data)?data[0]:data
  if(!row)throw new Error('Presa in carico non confermata dal server')
  const updated=fromRow(row)
  if(updated.status!=='presa_in_carico')throw new Error('Presa in carico non confermata dal server')
  return updated
}
async function atomicComplete(id,hotelId,name){
  if(!hotelId)throw new Error('Struttura dell’avviso non disponibile')
  const{data,error}=await supabase.rpc('completa_urgente',{p_id:id,p_hotel_id:hotelId,p_nome:name})
  if(error)throw error
  const row=Array.isArray(data)?data[0]:data
  if(!row)throw new Error('Completamento non confermato dal server')
  return fromRow(row)
}
async function dbUpdate(id,changes){
  if(!changes.hotelId)throw new Error('Struttura dell’avviso non disponibile')
  if(changes.status==='presa_in_carico'&&changes.takenBy)return atomicTake(id,changes.hotelId,changes.takenBy)
  if(changes.status==='completata'&&changes.completedBy&&!changes.transformedIssueId)return atomicComplete(id,changes.hotelId,changes.completedBy)
  if(changes._syncBaseUpdatedAt){const{data:current,error:readError}=await supabase.from('richieste_urgenti').select('*').eq('id',id).single();if(readError)throw readError;const currentApp=fromRow(current),fields=Object.keys(changes._syncBaseValues||{}).filter((key)=>!same(currentApp[key],changes._syncBaseValues[key]));if(fields.length)throw conflictError(fields)}
  const{data,error}=await supabase.from('richieste_urgenti').update(toRow(changes)).eq('id',id).eq('hotel_id',changes.hotelId).select().single();if(error)throw error;return fromRow(data)
}
registerOfflineHandler(ENTITY,async(op,targetId)=>op.action==='create'?dbInsert(op.payload):dbUpdate(targetId,{...op.payload,hotelId:op.hotelId}))

export async function fetchUrgents(hotelId){if(!supabase||!onlineNow())return{items:await getCachedCollection(ENTITY,hotelId),ok:false,offline:true};try{const{data,error}=await supabase.from('richieste_urgenti').select('*').eq('hotel_id',hotelId).order('creato_il',{ascending:false});if(error)throw error;return{items:await cacheRemoteCollection(ENTITY,hotelId,(data||[]).map(fromRow)),ok:true}}catch(error){return{items:await getCachedCollection(ENTITY,hotelId),ok:false,offline:isTransientNetworkError(error),error:error?.message}}}
export async function fetchUrgentEvents(urgentId){if(!supabase||!onlineNow()||String(urgentId).startsWith('offline-'))return[];const{data,error}=await supabase.from('richieste_urgenti_eventi').select('*').eq('urgente_id',urgentId).order('creato_il',{ascending:true});if(error)throw error;return(data||[]).map(row=>({id:row.id,type:row.tipo,by:row.da_chi,details:row.dettagli||{},createdAt:new Date(row.creato_il).getTime()}))}
export async function insertUrgent(item){const nextItem={severity:'urgente',...item,clientMutationId:item.clientMutationId||makeClientMutationId()};if(!supabase||!onlineNow()){const tempId=makeOfflineId('offline-urgent');operationSaved('Avviso salvato sul dispositivo — non ancora trasmesso');return enqueueMutation({entity:ENTITY,hotelId:nextItem.hotelId,action:'create',payload:{...nextItem,createdAt:nextItem.createdAt||Date.now(),_notifyOnSync:true},cachePayload:{...nextItem,createdAt:nextItem.createdAt||Date.now()},tempId})}try{const created=await dbInsert(nextItem);await cacheRemoteCollection(ENTITY,nextItem.hotelId,[created,...(await getCachedCollection(ENTITY,nextItem.hotelId)).filter(x=>x.id!==created.id)]);operationSaved('Avviso urgente trasmesso');return created}catch(error){if(isTransientNetworkError(error)){const tempId=makeOfflineId('offline-urgent');operationSaved('Avviso salvato sul dispositivo — non ancora trasmesso');return enqueueMutation({entity:ENTITY,hotelId:nextItem.hotelId,action:'create',payload:{...nextItem,createdAt:nextItem.createdAt||Date.now(),_notifyOnSync:true},cachePayload:{...nextItem,createdAt:nextItem.createdAt||Date.now()},tempId})}operationFailed(error,'Avviso urgente non salvato');throw error}}
export async function updateUrgentRow(id,changes){
  let hotelId=null
  try{hotelId=await resolveHotelId(id,changes.hotelId||null)}catch(error){operationFailed(error,'Impossibile identificare la struttura dell’avviso');throw error}
  if(!hotelId){const error=new Error('Struttura dell’avviso non disponibile');operationFailed(error,error.message);throw error}
  if(!supabase||!onlineNow()||String(id).startsWith('offline-')){const based=await withSyncBase(id,hotelId,{...changes,hotelId});return enqueueMutation({entity:ENTITY,hotelId,action:'update',payload:based,cachePayload:changes,targetId:id})}
  try{
    const updated=await dbUpdate(id,{...changes,hotelId})
    const cached=await getCachedCollection(ENTITY,hotelId)
    await cacheRemoteCollection(ENTITY,hotelId,cached.map(item=>item.id===id?updated:item))
    operationSaved(changes.status==='presa_in_carico'?`Avviso preso in carico${updated.takenBy?` da ${updated.takenBy}`:''}`:changes.status==='completata'?'Avviso completato':'Avviso aggiornato')
    return updated
  }catch(error){
    if(isTransientNetworkError(error)){
      const based=await withSyncBase(id,hotelId,{...changes,hotelId})
      return enqueueMutation({entity:ENTITY,hotelId,action:'update',payload:based,cachePayload:changes,targetId:id})
    }
    operationFailed(error,error?.message?.includes('già preso')?error.message:'Avviso non aggiornato')
    requestUrgentRefresh(hotelId)
    throw error
  }
}
export async function linkUrgentToIssue(id,hotelId,issueId,completedBy){const{data,error}=await supabase.from('richieste_urgenti').update({stato:'completata',completata_da:completedBy,completata_il:new Date().toISOString(),trasformata_in_segnalazione_id:issueId,updated_at:new Date().toISOString()}).eq('id',id).eq('hotel_id',hotelId).select().single();if(error)throw error;return fromRow(data)}
export function subscribeUrgents(hotelId,onChange){const onOffline=(event)=>{if(event.detail?.entity===ENTITY&&event.detail?.hotelId===hotelId)onChange({eventType:'OFFLINE_SYNC'})};if(typeof window!=='undefined')window.addEventListener('apice-offline-data-changed',onOffline);let channel=null;if(supabase)channel=supabase.channel('apice-urgenti-'+hotelId).on('postgres_changes',{event:'*',schema:'public',table:'richieste_urgenti',filter:`hotel_id=eq.${hotelId}`},onChange).subscribe();return()=>{if(channel)supabase.removeChannel(channel);if(typeof window!=='undefined')window.removeEventListener('apice-offline-data-changed',onOffline)}}
