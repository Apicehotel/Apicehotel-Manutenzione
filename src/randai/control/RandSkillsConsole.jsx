import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import {
  buildUnifiedRandCapabilityCatalog,
  filterUnifiedRandCapabilityCatalog,
  summarizeUnifiedRandCapabilityCatalog,
} from '../skills/unified-catalog.js'
import './randskills-console.css'

const HOTEL={hotelgio:'Hotel Giò',chocohotel:'Chocohotel',brigantino:'Il Brigantino'}
const KIND_LABEL={skill:'Skill',mcp:'MCP'}

function StatusPill({children,tone='neutral'}) {
  return <span className={`rsm-pill rsm-pill--${tone}`}>{children}</span>
}

export default function RandSkillsConsole({accessHotels=[],hotelFilter='all'}){
  const catalog=useMemo(()=>buildUnifiedRandCapabilityCatalog(),[])
  const [kind,setKind]=useState('all')
  const [profile,setProfile]=useState('all')
  const [query,setQuery]=useState('')
  const [live,setLive]=useState([])
  const [notice,setNotice]=useState('')
  const [busy,setBusy]=useState(false)
  const activeHotel=hotelFilter==='all'?(accessHotels[0]||null):hotelFilter

  const loadLive=useCallback(async()=>{
    if(!supabase||!activeHotel){setLive([]);return}
    setBusy(true);setNotice('')
    const {data,error}=await supabase.functions.invoke('rand-capability-broker',{
      body:{capability:'broker.status',hotelId:activeHotel,input:{}},
    })
    if(error){
      setNotice('Stato MCP live non disponibile per questa sessione. Il catalogo locale resta valido.')
      setLive([])
    }else if(!data?.ok){
      setNotice(data?.error==='mcp_infrastructure_forbidden'
        ? 'Stato MCP live riservato ad amministratori/RandAI.'
        : 'Broker MCP non disponibile.')
      setLive([])
    }else{
      setLive(data?.result?.servers||[])
    }
    setBusy(false)
  },[activeHotel])

  useEffect(()=>{loadLive()},[loadLive])

  const filtered=useMemo(()=>filterUnifiedRandCapabilityCatalog(catalog,{kind,query,profile}),[catalog,kind,query,profile])
  const summary=useMemo(()=>summarizeUnifiedRandCapabilityCatalog(catalog,live),[catalog,live])
  const liveById=useMemo(()=>new Map(live.map((row)=>[row.serverId,row])),[live])

  return <div className="rsm-root" data-testid="randskills-manager">
    <section className="rsm-hero">
      <div>
        <small>CATALOGO UNICO</small>
        <h3>RandSkills & MCP</h3>
        <p>Un solo posto per vedere competenze, MCP, profili, sorgenti e stato operativo. Il catalogo non concede permessi: RandCore, ToolRegistry, RLS e HITL restano le autorità.</p>
      </div>
      <button type="button" onClick={loadLive} disabled={busy||!activeHotel}>{busy?'Controllo…':'Aggiorna stato MCP'}</button>
    </section>

    <div className="rsm-metrics">
      <article><strong>{summary.skillCount}</strong><span>Skill</span></article>
      <article><strong>{summary.mcpCount}</strong><span>MCP registrati</span></article>
      <article><strong>{summary.profileCount}</strong><span>Profili</span></article>
      <article><strong>{summary.enabledMcpCount}</strong><span>MCP abilitati live</span></article>
    </div>

    <div className="rsm-context">
      <span>Skill catalog v{catalog.version.skills||'—'}</span>
      <span>MCP registry v{catalog.version.mcp||'—'}</span>
      <span>{activeHotel?HOTEL[activeHotel]||activeHotel:'Nessun hotel selezionato'}</span>
    </div>
    {notice&&<div className="rc-notice">{notice}</div>}

    <section className="rsm-filters" aria-label="Filtri RandSkills e MCP">
      <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cerca skill, MCP, tool, capability…" aria-label="Cerca skill e MCP"/>
      <select value={kind} onChange={(e)=>setKind(e.target.value)} aria-label="Tipo">
        <option value="all">Tutti</option><option value="skill">Skill</option><option value="mcp">MCP</option>
      </select>
      <select value={profile} onChange={(e)=>setProfile(e.target.value)} aria-label="Profilo MCP">
        <option value="all">Tutti i profili</option>
        {catalog.profiles.map((item)=><option key={item.id} value={item.id}>{item.id}</option>)}
      </select>
    </section>

    <div className="rsm-grid">
      {filtered.map((item)=>{
        const state=item.kind==='mcp'?liveById.get(item.id):null
        const tone=item.kind==='skill'?'ok':state?.enabled?'ok':state?'muted':'neutral'
        return <article className="rsm-card" key={item.key}>
          <header>
            <div><small>{KIND_LABEL[item.kind]} · {item.id}</small><h4>{item.name}</h4></div>
            <StatusPill tone={tone}>{item.kind==='skill'?item.status:(state?.enabled?'ABILITATO':state?'DISABILITATO':'REGISTRATO')}</StatusPill>
          </header>
          <p>{item.description}</p>
          <dl>
            {item.version&&<><dt>Versione</dt><dd>{item.version}</dd></>}
            <dt>Sorgente</dt><dd>{item.source||'Interna'}</dd>
            <dt>Governance</dt><dd>{item.governedBy}</dd>
            <dt>Permessi</dt><dd>{item.permissions.join(', ')||'—'}</dd>
            {item.requiredTools.length>0&&<><dt>Tool</dt><dd>{item.requiredTools.join(', ')}</dd></>}
            {item.capabilities.length>0&&<><dt>Capability</dt><dd>{item.capabilities.join(', ')}</dd></>}
            {item.profiles.length>0&&<><dt>Profili</dt><dd>{item.profiles.join(', ')}</dd></>}
            {state&&<><dt>Credenziali</dt><dd>{state.credentialsReady?'Configurate':'Non configurate'}</dd></>}
          </dl>
          <div className="rsm-tags">{item.tags.map((tag)=><span key={tag}>{tag}</span>)}</div>
        </article>
      })}
    </div>
    {!filtered.length&&<div className="rsm-empty">Nessuna capacità corrisponde ai filtri.</div>}
  </div>
}
