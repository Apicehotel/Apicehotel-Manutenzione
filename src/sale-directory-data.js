import { supabase } from './supabase.js'

const clientFromRow=(row)=>({id:row.id,hotelId:row.hotel_id,name:row.name,preferredRoomKey:row.preferred_room_key||'',preferredLayoutKey:row.preferred_layout_key||'',preferredPax:row.preferred_pax||'',recurringNotes:row.recurring_notes||'',active:row.active!==false,updatedAt:row.updated_at})
const layoutFromRow=(row)=>({hotelId:row.hotel_id,key:row.layout_key,name:row.name,active:row.active!==false,sortOrder:row.sort_order??0})
const slug=(value='')=>String(value).trim().toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')

export async function fetchSaleClients(hotelId){
  if(!supabase)return[]
  const{data,error}=await supabase.from('sale_clients').select('*').eq('hotel_id',hotelId).eq('active',true).order('name',{ascending:true})
  if(error)throw error
  return(data||[]).map(clientFromRow)
}
export async function upsertSaleClient({hotelId,id,name,preferredRoomKey,preferredLayoutKey,preferredPax,recurringNotes=''}){
  const payload={hotel_id:hotelId,name:name.trim(),preferred_room_key:preferredRoomKey||null,preferred_layout_key:preferredLayoutKey||null,preferred_pax:preferredPax?Number(preferredPax):null,recurring_notes:recurringNotes||'',active:true}
  let query=id?supabase.from('sale_clients').update(payload).eq('id',id):supabase.from('sale_clients').upsert(payload,{onConflict:'hotel_id,name'})
  const{data,error}=await query.select().single()
  if(error)throw error
  return clientFromRow(data)
}
export async function fetchSaleLayouts(hotelId){
  if(!supabase)return[]
  const{data,error}=await supabase.from('sale_layouts_config').select('*').eq('hotel_id',hotelId).eq('active',true).order('sort_order',{ascending:true}).order('name',{ascending:true})
  if(error)throw error
  return(data||[]).map(layoutFromRow)
}
export async function upsertSaleLayout({hotelId,name,key,sortOrder}){
  if(!supabase)throw new Error('Supabase non disponibile')
  const cleanName=String(name||'').trim()
  if(!cleanName)throw new Error('Inserisci il nome della configurazione')
  const layoutKey=key||slug(cleanName)||`layout-${Date.now().toString(36)}`
  const nextSort=Number.isFinite(Number(sortOrder))?Number(sortOrder):100
  const payload={hotel_id:hotelId,layout_key:layoutKey,name:cleanName,active:true,sort_order:nextSort}
  const{data,error}=await supabase.from('sale_layouts_config').upsert(payload,{onConflict:'hotel_id,layout_key'}).select().single()
  if(error)throw error
  return layoutFromRow(data)
}
