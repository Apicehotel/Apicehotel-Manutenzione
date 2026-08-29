import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import './randai-console.css'

const HOTEL_LABELS = { hotelgio:'Hotel Giò', chocohotel:'Chocohotel', brigantino:'Il Brigantino' }
const EMPTY = { hotel_id:'hotelgio', title:'', category:'', area:'', equipment_id:'', symptom:'', summary:'', steps_text:'', caution:'', source_label:'Conoscenza interna RandAI', source_type:'procedura_interna', drive_url:'', media_kind:'document', status:'draft' }
const makeId = () => `randai-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
const parseSteps = (text) => String(text || '').split('\n').map((x)=>x.trim()).filter(Boolean)
const driveUrl = (value) => { const raw=String(value||'').trim(); if(!raw) return ''; try { const u=new URL(raw); return ['drive.google.com','docs.google.com'].includes(u.hostname) ? u.toString() : null } catch { return null } }

export default function RandAIConsole(){
  const [access,setAccess]=useState({loading:true,allowed:false,hotels:[],name:''})
  const [rows,setRows]=useState([]), [equipment,setEquipment]=useState([])
  const [form,setForm]=useState(EMPTY), [selectedId,setSelectedId]=useState(null)
  const [busy,setBusy]=useState(false), [notice,setNotice]=useState('')
  const [filterHotel,setFilterHotel]=useState('all'), [filterStatus,setFilterStatus]=useState('all'), [search,setSearch]=useState('')
  const [testQuery,setTestQuery]=useState(''), [testResult,setTestResult]=useState(null)

  const checkAccess = async () => {
    if(!supabase){ setAccess({loading:false,allowed:false,hotels:[],name:''}); return }
    const { data:userData } = await supabase.auth.getUser()
    const user=userData?.user
    if(!user){ setAccess({loading:false,allowed:false,hotels:[],name:''}); return }
    const { data:memberships } = await supabase.from('hotel_memberships').select('hotel_id,active,can_access_admin').eq('auth_user_id',user.id).eq('active',true).eq('can_access_admin',true)
    const hotels=(memberships||[]).map((x)=>x.hotel_id).filter(Boolean)
    const { data:profile } = await supabase.from('profiles').select('display_name').eq('auth_user_id',user.id).maybeSingle()
    setAccess({loading:false,allowed:hotels.length>0,hotels,name:profile?.display_name||user.email||'Admin'})
    if(hotels.length===1){ setFilterHotel(hotels[0]); setForm((f)=>({...f,hotel_id:hotels[0]})) }
  }

  const load = async () => {
    if(!supabase || !access.allowed) return
    setBusy(true)
    try {
      const [{data:p,error:pe},{data:e,error:ee}] = await Promise.all([
        supabase.from('randai_procedures').select('id,hotel_id,title,category,area,symptom,summary,steps,caution,source_label,status,version,updated_at').in('hotel_id',access.hotels).order('updated_at',{ascending:false}),
        supabase.from('randai_equipment').select('id,hotel_id,name,category,location,active').in('hotel_id',access.hotels).eq('active',true).order('name'),
      ])
      if(pe) throw pe; if(ee) throw ee
      setRows(p||[]); setEquipment(e||[])
    } catch(error){ setNotice(`Errore caricamento: ${error?.message||'non disponibile'}`) }
    finally{ setBusy(false) }
  }

  useEffect(()=>{ checkAccess() },[])
  useEffect(()=>{ if(access.allowed) load() },[access.allowed])

  const visible=useMemo(()=>rows.filter((r)=>{
    if(filterHotel!=='all'&&r.hotel_id!==filterHotel) return false
    if(filterStatus!=='all'&&r.status!==filterStatus) return false
    const h=`${r.title} ${r.category} ${r.area} ${r.symptom} ${r.summary}`.toLowerCase()
    return !search.trim()||h.includes(search.trim().toLowerCase())
  }),[rows,filterHotel,filterStatus,search])
  const gear=useMemo(()=>equipment.filter((x)=>x.hotel_id===form.hotel_id),[equipment,form.hotel_id])

  const startNew=()=>{ const h=filterHotel!=='all'?filterHotel:(access.hotels[0]||'hotelgio'); setSelectedId(null);setForm({...EMPTY,hotel_id:h});setTestResult(null);setNotice('Nuova conoscenza in bozza') }
  const edit=(r)=>{setSelectedId(r.id);setForm({...EMPTY,hotel_id:r.hotel_id,title:r.title||'',category:r.category||'',area:r.area||'',symptom:r.symptom||'',summary:r.summary||'',steps_text:(r.steps||[]).join('\n'),caution:r.caution||'',source_label:r.source_label||'Conoscenza interna RandAI',status:r.status||'draft'});setTestResult(null);setNotice('')}

  const save = async (status=form.status) => {
    if(!form.title.trim()||!form.summary.trim()){setNotice('Titolo e nozione verificata sono obbligatori.');return}
    if(!access.hotels.includes(form.hotel_id)){setNotice('Hotel non autorizzato.');return}
    const media=driveUrl(form.drive_url); if(form.drive_url.trim()&&!media){setNotice('Inserisci un link Google Drive o Google Docs valido.');return}
    setBusy(true);setNotice('')
    try{
      const id=selectedId||makeId()
      const keywords=Array.from(new Set(`${form.category} ${form.area} ${form.symptom} ${form.title}`.toLowerCase().split(/[^a-zà-ÿ0-9]+/i).filter((x)=>x.length>2))).slice(0,24)
      const payload={id,hotel_id:form.hotel_id,title:form.title.trim(),category:form.category.trim()||'generale',area:form.area.trim()||null,symptom:form.symptom.trim()||null,summary:form.summary.trim(),keywords,steps:parseSteps(form.steps_text),caution:form.caution.trim()||null,source_label:form.source_label.trim()||'Conoscenza interna RandAI',status,approved_at:status==='approved'?new Date().toISOString():null,updated_at:new Date().toISOString()}
      const q=selectedId?supabase.from('randai_procedures').update(payload).eq('id',id):supabase.from('randai_procedures').insert(payload)
      const {error}=await q; if(error) throw error
      if(media){
        const doc={hotel_id:form.hotel_id,equipment_id:form.equipment_id||null,title:`${form.title.trim()} — allegato`,source_type:form.source_type,source_label:form.source_label.trim()||'Google Drive',external_url:media,media_kind:form.media_kind,storage_path:null,status,approved_at:status==='approved'?new Date().toISOString():null,updated_at:new Date().toISOString()}
        const {data:existing}=await supabase.from('randai_documents').select('id').eq('hotel_id',form.hotel_id).eq('external_url',media).maybeSingle()
        const {error:de}=existing?.id?await supabase.from('randai_documents').update(doc).eq('id',existing.id):await supabase.from('randai_documents').insert(doc)
        if(de) throw de
      }
      setSelectedId(id);setForm((f)=>({...f,status}));setNotice(status==='approved'?'Conoscenza approvata: RandAI può usarla.':'Bozza salvata.');await load()
    }catch(error){setNotice(`Salvataggio non riuscito: ${error?.message||'errore'}`)}finally{setBusy(false)}
  }

  const archive=async()=>{if(!selectedId)return;setBusy(true);const {error}=await supabase.from('randai_procedures').update({status:'archived',approved_at:null,updated_at:new Date().toISOString()}).eq('id',selectedId);setBusy(false);setNotice(error?`Archiviazione non riuscita: ${error.message}`:'Conoscenza archiviata.');if(!error){setForm((f)=>({...f,status:'archived'}));await load()}}
  const test=async()=>{if(!testQuery.trim())return;setBusy(true);setTestResult(null);try{const {data,error}=await supabase.functions.invoke('randai-assistant',{body:{hotel_id:form.hotel_id,query:testQuery.trim()}});if(error)throw error;setTestResult(data)}catch(error){setTestResult({ok:false,error:error?.message||'test_failed'})}finally{setBusy(false)}}

  if(access.loading) return <div className="rk-shell"><div className="rk-gate">Controllo accesso RandAI…</div></div>
  if(!access.allowed) return <div className="rk-shell"><div className="rk-gate"><img src="/icons/randai-cat.webp" alt=""/><h1>RandAI Knowledge Console</h1><p>Questa area richiede una sessione RandApp con accesso amministrativo.</p><button onClick={()=>window.location.assign('/')}>Apri RandApp</button></div></div>

  return <div className="rk-shell">
    <header className="rk-head"><div><span className="rk-kicker">RandAI Knowledge Console</span><h1>Conoscenze RandAI</h1><p>Dati, procedure e fonti approvate. Accesso: {access.name}.</p></div><div className="rk-head-actions"><button onClick={()=>window.location.assign('/')}>← RandApp</button><button className="rk-primary" onClick={startNew}>+ Nuova conoscenza</button></div></header>
    <div className="rk-grid">
      <aside className="rk-list"><div className="rk-filters"><select value={filterHotel} onChange={(e)=>setFilterHotel(e.target.value)}>{access.hotels.length>1&&<option value="all">Tutti gli hotel</option>}{access.hotels.map((id)=><option key={id} value={id}>{HOTEL_LABELS[id]||id}</option>)}</select><select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)}><option value="all">Tutti gli stati</option><option value="draft">Bozza</option><option value="approved">Approvata</option><option value="archived">Archiviata</option></select><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Cerca conoscenze…"/></div><div className="rk-items">{visible.map((r)=><button type="button" className={`rk-card ${selectedId===r.id?'is-active':''}`} key={r.id} onClick={()=>edit(r)}><div><strong>{r.title}</strong><span>{r.area||r.category||'Generale'}</span></div><em className={`rk-state rk-state--${r.status}`}>{r.status}</em><small>{r.summary}</small></button>)}{!busy&&visible.length===0&&<div className="rk-empty">Nessuna conoscenza con questi filtri.</div>}</div></aside>
      <main className="rk-editor"><div className="rk-section-title"><div><span>Editor</span><h2>{selectedId?'Modifica conoscenza':'Nuova conoscenza'}</h2></div><em className={`rk-state rk-state--${form.status}`}>{form.status}</em></div>
        <div className="rk-form-grid"><label>Hotel<select value={form.hotel_id} onChange={(e)=>setForm({...form,hotel_id:e.target.value,equipment_id:''})}>{access.hotels.map((id)=><option key={id} value={id}>{HOTEL_LABELS[id]||id}</option>)}</select></label><label>Categoria<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} placeholder="climatizzazione"/></label><label className="rk-span-2">Titolo<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} placeholder="Es. Climatizzazione Wine — sensori tetto"/></label><label>Area / zona<input value={form.area} onChange={(e)=>setForm({...form,area:e.target.value})} placeholder="Wine"/></label><label>Impianto<select value={form.equipment_id} onChange={(e)=>setForm({...form,equipment_id:e.target.value})}><option value="">Nessuno / generale</option>{gear.map((x)=><option key={x.id} value={x.id}>{x.name} — {x.location}</option>)}</select></label><label className="rk-span-2">Problema / quando usarla<input value={form.symptom} onChange={(e)=>setForm({...form,symptom:e.target.value})} placeholder="Es. il Wine non raffredda"/></label><label className="rk-span-2">Nozione verificata<textarea rows="5" value={form.summary} onChange={(e)=>setForm({...form,summary:e.target.value})} placeholder="Scrivi il fatto che RandAI deve conoscere. Niente ipotesi non verificate."/></label><label className="rk-span-2">Controlli / procedura <small>Una riga = un passo</small><textarea rows="6" value={form.steps_text} onChange={(e)=>setForm({...form,steps_text:e.target.value})}/></label><label className="rk-span-2">Avvertenze<textarea rows="3" value={form.caution} onChange={(e)=>setForm({...form,caution:e.target.value})} placeholder="Sicurezza, limiti, escalation…"/></label></div>
        <section className="rk-media"><div className="rk-section-title"><div><span>Fonti e media</span><h3>Google Drive / Docs</h3></div></div><div className="rk-form-grid"><label>Tipo fonte<select value={form.source_type} onChange={(e)=>setForm({...form,source_type:e.target.value})}><option value="procedura_interna">Procedura interna</option><option value="manuale_interno">Manuale interno</option><option value="manuale_costruttore">Manuale costruttore</option><option value="scheda_tecnica">Scheda tecnica</option></select></label><label>Formato<select value={form.media_kind} onChange={(e)=>setForm({...form,media_kind:e.target.value})}><option value="document">Documento / PDF</option><option value="image">Foto</option><option value="video">Video</option><option value="link">Link</option></select></label><label className="rk-span-2">Etichetta fonte<input value={form.source_label} onChange={(e)=>setForm({...form,source_label:e.target.value})}/></label><label className="rk-span-2">Link Drive per PDF, foto o video<input value={form.drive_url} onChange={(e)=>setForm({...form,drive_url:e.target.value})} placeholder="https://drive.google.com/…"/><small>Il file resta su Drive. RandAI registra URL e tipo separatamente dallo Storage interno, evitando ambiguità.</small></label></div></section>
        <section className="rk-test"><div className="rk-section-title"><div><span>Anteprima</span><h3>Testa RandAI</h3></div></div><p className="rk-hint">Il test usa solo conoscenze già approvate: una bozza non influenza RandAI finché non viene approvata.</p><div className="rk-test-row"><input value={testQuery} onChange={(e)=>setTestQuery(e.target.value)} placeholder="Es. Non raffredda il 2° Wine, cosa controllo?"/><button onClick={test} disabled={!testQuery.trim()||busy}>Testa</button></div>{testResult&&<pre>{JSON.stringify(testResult,null,2)}</pre>}</section>
        {notice&&<div className="rk-notice">{notice}</div>}<footer className="rk-actions"><button onClick={()=>save('draft')} disabled={busy}>Salva bozza</button>{selectedId&&<button className="rk-danger" onClick={archive} disabled={busy}>Archivia</button>}<button className="rk-primary" onClick={()=>save('approved')} disabled={busy}>Approva</button></footer>
      </main>
    </div>
  </div>
}
