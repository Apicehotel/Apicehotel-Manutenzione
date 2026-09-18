import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import { buildAgentRuntimeBoard, agentStatusLabel } from '../control-center/agent-registry.js'
import { clientState, issueIcon, zoneState } from './world-engine.js'
import './randai-live.css'

const TONES={randai:'#56b7ff',randbrain:'#b981ff',randcore:'#ffad42',randmind:'#64d98b',randradar:'#ff5c62',randresearch:'#7fc8ff',randsecure:'#ff6464',randtest:'#e8d84b',randops:'#4fdbe8',randui:'#ff74d3'}
const GLYPHS={randai:'AI',randbrain:'🧠',randcore:'●',randmind:'◒',randradar:'◉',randresearch:'⌕',randsecure:'◆',randtest:'✓',randops:'⚙',randui:'♥'}

function fmtTime(value){
  if(!value)return'—'
  const d=new Date(value)
  return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})
}

function RandSprite({agent,onSelect,selected}){
  const p=agent.life
  const tone=TONES[agent.id]||'#7dd3fc'
  return <button className={`rl-agent rl-agent--${agent.status.toLowerCase()} rl-agent--${p.mode.toLowerCase()} ${selected?'is-selected':''}`}
    style={{'--x':p.x+'%','--y':p.y+'%','--tone':tone}} onClick={()=>onSelect(agent.id)} aria-label={agent.name}>
    <span className="rl-agent__bubble"><b>{p.action}</b><small>{p.label}</small></span>
    <span className={`rl-avatar rl-avatar--${agent.id}`} aria-hidden="true">
      <i className="rl-avatar__halo"/>
      <i className="rl-avatar__head"><b/><b/></i>
      <i className="rl-avatar__body">{GLYPHS[agent.id]}</i>
      <i className="rl-avatar__arm a"/>
      <i className="rl-avatar__arm b"/>
      <i className="rl-avatar__leg a"/>
      <i className="rl-avatar__leg b"/>
    </span>
    <span className="rl-agent__tag"><strong>{agent.name}</strong><small>{p.action}</small></span>
  </button>
}

function ClientNpc({issue,index,onSelect}){
  const p=clientState(issue,index)
  const urgent=p.urgency==='alta'
  return <button className={`rl-client rl-client--${p.urgency} rl-client--${String(issue.stato||'todo').toLowerCase()}`}
    style={{'--x':p.x+'%','--y':p.y+'%'}} onClick={()=>onSelect(issue)}>
    <span className="rl-client__bubble">{issueIcon(issue)}</span>
    <span className="rl-client__person"><i/><b/><em/></span>
    <span className="rl-client__label">{issue.camera||issue.categoria||'Segnalazione'}{urgent&&<b>URGENTE</b>}</span>
  </button>
}

function useIssues(hotelId){
  const [issues,setIssues]=useState([])
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!supabase||!hotelId){setIssues([]);return undefined}
    let active=true
    const load=async()=>{
      const {data,error:e}=await supabase.from('segnalazioni')
        .select('id,hotel_id,camera,urgenza,categoria,stato,note,creato_il,tecnico_nome')
        .eq('hotel_id',hotelId).neq('stato','done').order('creato_il',{ascending:true}).limit(36)
      if(!active)return
      if(e){setError(e.message);return}
      setError('');setIssues(data||[])
    }
    load()
    const channel=supabase.channel('randailive-issues-'+hotelId)
      .on('postgres_changes',{event:'*',schema:'public',table:'segnalazioni',filter:`hotel_id=eq.${hotelId}`},load).subscribe()
    return()=>{active=false;supabase.removeChannel(channel)}
  },[hotelId])
  return{issues,error}
}

export default function RandAILive({currentUser}){
  const allowedHotels=(currentUser?.hotels||[]).filter(Boolean)
  const [hotelId,setHotelId]=useState(()=>allowedHotels[0]||HOTELS[0]?.id||'hotelgio')
  const [rows,setRows]=useState([])
  const [now,setNow]=useState(Date.now())
  const [runtimeError,setRuntimeError]=useState('')
  const [selectedAgent,setSelectedAgent]=useState(null)
  const [selectedIssue,setSelectedIssue]=useState(null)
  const {issues,error:issueError}=useIssues(hotelId)

  useEffect(()=>{if(allowedHotels.length&&!allowedHotels.includes(hotelId))setHotelId(allowedHotels[0])},[allowedHotels.join('|')])

  useEffect(()=>{
    const timer=window.setInterval(()=>setNow(Date.now()),1000)
    if(!supabase)return()=>window.clearInterval(timer)
    let active=true
    const load=async()=>{
      const {data,error}=await supabase.from('randcore_agent_runtime')
        .select('agent_id,status,desired_state,heartbeat_at,task_id,activity,detail,hotel_id,updated_at').order('agent_id')
      if(!active)return
      if(error){setRuntimeError(error.message);return}
      setRuntimeError('');setRows(data||[])
    }
    load()
    const channel=supabase.channel('randailive-agent-runtime')
      .on('postgres_changes',{event:'*',schema:'public',table:'randcore_agent_runtime'},load).subscribe()
    return()=>{active=false;window.clearInterval(timer);supabase.removeChannel(channel)}
  },[])

  const board=useMemo(()=>buildAgentRuntimeBoard(rows.map(row=>({...row,agentId:row.agent_id,heartbeatAt:row.heartbeat_at,taskId:row.task_id,hotelId:row.hotel_id,updatedAt:row.updated_at})),now)
    .map(agent=>({...agent,life:zoneState(agent,now)})),[rows,now])
  const counts=useMemo(()=>board.reduce((m,a)=>(m[a.status]=(m[a.status]||0)+1,m),{}),[board])
  const issueCounts=useMemo(()=>issues.reduce((m,i)=>{const k=String(i.stato||'todo');m[k]=(m[k]||0)+1;return m},{}),[issues])
  const selected=board.find(a=>a.id===selectedAgent)||null
  const hotel=HOTELS.find(h=>h.id===hotelId)

  return <main className="rl-shell">
    <header className="rl-topbar">
      <div className="rl-brand"><button type="button" onClick={()=>window.location.assign('/randai')}>← RandAI</button><strong>RandAILive</strong><span className="rl-live-dot">LIVE</span></div>
      <div className="rl-hotel-tabs">{HOTELS.filter(h=>!allowedHotels.length||allowedHotels.includes(h.id)).map(h=><button key={h.id} className={hotelId===h.id?'active':''} onClick={()=>{setHotelId(h.id);setSelectedIssue(null)}}>{h.short}</button>)}</div>
      <div className="rl-topstats"><span><b>{issues.length}</b> clienti</span><span><b>{issueCounts.todo||0}</b> lobby</span><span><b>{issueCounts.waiting||0}</b> attesa</span><span><b>{counts.RUNNING||0}</b> Rand al lavoro</span></div>
    </header>

    <section className="rl-layout">
      <div className="rl-world-wrap">
        <div className="rl-world">
          <div className="rl-wall rl-wall--left"/>
          <div className="rl-wall rl-wall--right"/>
          <div className="rl-zone rl-brain"><b>RandBrain</b><small>PLAN · REASON</small></div>
          <div className="rl-zone rl-cafe"><b>COFFEE</b><small>PAUSA · INCONTRI</small></div>
          <div className="rl-elevators"><b>ELEVATORS</b><i/><i/><i/></div>
          <div className="rl-zone rl-knowledge"><b>RandMind</b><small>KNOWLEDGE</small></div>
          <div className="rl-zone rl-research"><b>RandResearch</b><small>EXPLORE · ANALYZE</small></div>
          <div className="rl-zone rl-reception"><b>RECEPTION</b><small>NUOVE SEGNALAZIONI</small></div>
          <div className="rl-core"><b>RandCore Hub</b><span>●</span><small>ORCHESTRATE · CONNECT</small></div>
          <div className="rl-zone rl-secure"><b>RandSecure</b><small>PROTECT · MONITOR</small></div>
          <div className="rl-zone rl-ops"><b>RandOps</b><small>OPERATE · SCALE</small></div>
          <div className="rl-zone rl-ui"><b>RandUI</b><small>DESIGN · DELIGHT</small></div>
          <div className="rl-zone rl-radar"><b>RandRadar</b><small>SCAN · DISCOVER</small></div>
          <div className="rl-zone rl-test"><b>RandTest</b><small>VERIFY · IMPROVE</small></div>
          <div className="rl-zone rl-service"><b>SERVICE</b><small>MANUTENZIONE</small></div>
          <div className="rl-waiting">
            <header><b>SALA ATTESA</b><small>SEGNALAZIONI IN ATTESA · {hotel?.name||hotelId}</small></header>
            <div className="rl-sofas"><i/><i/><i/><i/><i/><i/><i/><i/></div>
            <div className="rl-tables"><i/><i/><i/><i/></div>
          </div>
          <div className="rl-entrance"><b>INGRESSO</b></div>
          <div className="rl-exit"><b>USCITA</b></div>

          {issues.map((issue,index)=><ClientNpc key={issue.id} issue={issue} index={index} onSelect={setSelectedIssue}/>)}
          {board.map(agent=><RandSprite key={agent.id} agent={agent} selected={selectedAgent===agent.id} onSelect={setSelectedAgent}/>)}
        </div>
        <div className="rl-legend"><span>CLIENTI = segnalazioni reali</span><span>WANDER = vita libera</span><span>WORK = task reale</span><span>DONE = il cliente lascia l’hotel</span></div>
      </div>

      <aside className="rl-side">
        <section className="rl-panel">
          <header><strong>Clienti / segnalazioni</strong><span>{issues.length} APERTE</span></header>
          {selectedIssue?<div className="rl-ticket"><button onClick={()=>setSelectedIssue(null)}>×</button><strong>{selectedIssue.camera||'Segnalazione'}</strong><em>{selectedIssue.categoria||'Varie'} · {selectedIssue.urgenza||'media'}</em><p>{selectedIssue.note||'Nessuna descrizione'}</p><small>Stato: {selectedIssue.stato||'todo'}</small></div>
          :<div className="rl-ticket-summary"><p><b>{issueCounts.todo||0}</b> appena arrivati</p><p><b>{issueCounts.waiting||0}</b> in sala attesa</p><p><b>{issueCounts.tecnico||0}</b> in area service</p></div>}
        </section>
        <section className="rl-panel">
          <header><strong>Regia Rand</strong><span>{selected?'FOLLOW':'FREE CAM'}</span></header>
          {selected?<div className="rl-profile"><div style={{'--tone':TONES[selected.id]}}>{GLYPHS[selected.id]}</div><h2>{selected.name}</h2><p>{selected.life.action}</p><small>{selected.life.label}</small><b>{agentStatusLabel(selected.status)}</b><button onClick={()=>setSelectedAgent(null)}>Smetti di seguire</button></div>
          :<p className="rl-empty">Tocca un Rand nella hall per seguirlo.</p>}
        </section>
        <section className="rl-panel">
          <header><strong>Stato Rand</strong><span>{fmtTime(now)}</span></header>
          {board.map(a=><button className="rl-status" key={a.id} onClick={()=>setSelectedAgent(a.id)}><span><i style={{background:TONES[a.id]}}/>{a.name}</span><b>{a.life.action}</b></button>)}
        </section>
        {(runtimeError||issueError)&&<div className="rl-error">{runtimeError||issueError}</div>}
      </aside>
    </section>
  </main>
}
