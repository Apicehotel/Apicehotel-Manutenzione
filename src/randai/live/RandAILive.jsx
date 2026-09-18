import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { buildAgentRuntimeBoard, agentStatusLabel } from '../control-center/agent-registry.js'
import './randai-live.css'

const STATIONS = Object.freeze({
  randai:{x:16,y:34,glyph:'💬',label:'Reception AI'},
  randbrain:{x:31,y:27,glyph:'🧠',label:'Planning Lab'},
  randcore:{x:50,y:30,glyph:'⚙',label:'Core Hub'},
  randmind:{x:68,y:27,glyph:'▤',label:'Knowledge Library'},
  randradar:{x:84,y:34,glyph:'◉',label:'Radar Deck'},
  randresearch:{x:18,y:68,glyph:'⌕',label:'Research Desk'},
  randsecure:{x:34,y:72,glyph:'🔒',label:'Secure Gate'},
  randtest:{x:50,y:76,glyph:'✓',label:'QA Station'},
  randops:{x:67,y:70,glyph:'🔧',label:'Ops Bay'},
  randui:{x:83,y:66,glyph:'✦',label:'Design Studio'},
})

const TONES={randai:'#56b7ff',randbrain:'#b981ff',randcore:'#ffad42',randmind:'#64d98b',randradar:'#ff5c62',randresearch:'#7fc8ff',randsecure:'#ff6464',randtest:'#e8d84b',randops:'#4fdbe8',randui:'#ff74d3'}

function fmtTime(value){
  if(!value)return '—'
  const d=new Date(value)
  if(Number.isNaN(d.getTime()))return '—'
  return d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})
}

function PixelBot({agent}){
  const station=STATIONS[agent.id]||{x:50,y:50,glyph:'•',label:''}
  const tone=TONES[agent.id]||'#7dd3fc'
  return <article
    className={`rl-agent rl-agent--${agent.status.toLowerCase()} rl-agent--${agent.id}`}
    style={{'--x':`${station.x}%`,'--y':`${station.y}%`,'--tone':tone}}
    data-agent={agent.id}
  >
    <div className="rl-agent__bubble">{agent.status==='RUNNING'?(agent.activity||'Al lavoro…'):agent.status==='ERROR'?(agent.detail||'Errore'):agent.status==='WAITING_APPROVAL'?'Attende approvazione':agent.status==='IDLE'?'Disponibile':'Nessun heartbeat recente'}</div>
    <div className="rl-bot" aria-hidden="true">
      <span className="rl-bot__antenna"/>
      <span className="rl-bot__head"><i/><i/></span>
      <span className="rl-bot__body">{station.glyph}</span>
      <span className="rl-bot__arm rl-bot__arm--l"/>
      <span className="rl-bot__arm rl-bot__arm--r"/>
      <span className="rl-bot__leg rl-bot__leg--l"/>
      <span className="rl-bot__leg rl-bot__leg--r"/>
    </div>
    <div className="rl-agent__tag"><strong>{agent.name}</strong><small>{station.label}</small></div>
  </article>
}

export default function RandAILive(){
  const [rows,setRows]=useState([])
  const [now,setNow]=useState(Date.now())
  const [error,setError]=useState('')

  useEffect(()=>{
    if(!supabase){setError('Supabase non configurato');return undefined}
    let active=true
    const load=async()=>{
      const {data,error:queryError}=await supabase.from('randcore_agent_runtime').select('agent_id,status,desired_state,heartbeat_at,task_id,activity,detail,hotel_id,updated_at').order('agent_id')
      if(!active)return
      if(queryError){setError(queryError.message);return}
      setError('')
      setRows(data||[])
      setNow(Date.now())
    }
    load()
    const timer=window.setInterval(()=>setNow(Date.now()),30000)
    const channel=supabase.channel('randai-live-world').on('postgres_changes',{event:'*',schema:'public',table:'randcore_agent_runtime'},load).subscribe()
    return()=>{active=false;window.clearInterval(timer);supabase.removeChannel(channel)}
  },[])

  const board=useMemo(()=>buildAgentRuntimeBoard(rows.map((row)=>({...row,agentId:row.agent_id,heartbeatAt:row.heartbeat_at,taskId:row.task_id,hotelId:row.hotel_id,updatedAt:row.updated_at})),now),[rows,now])
  const counts=useMemo(()=>board.reduce((acc,a)=>{acc[a.status]=(acc[a.status]||0)+1;return acc},{}),[board])
  const activity=useMemo(()=>[...board].filter((a)=>a.heartbeatAt).sort((a,b)=>new Date(b.heartbeatAt)-new Date(a.heartbeatAt)).slice(0,8),[board])

  return <main className="rl-shell">
    <header className="rl-topbar">
      <div><button type="button" onClick={()=>window.location.assign('/randai')}>← RandAI</button><strong>RandAILive</strong><span className="rl-live-dot">LIVE</span></div>
      <div className="rl-topstats"><span>{board.length} agenti</span><span>{counts.RUNNING||0} al lavoro</span><span>{counts.ERROR||0} errori</span></div>
    </header>

    <section className="rl-layout">
      <div className="rl-world-wrap">
        <div className="rl-world">
          <div className="rl-sky"><span/><span/><span/><span/><span/></div>
          <div className="rl-hotel-sign">RANDAPP HOTEL<small>AI OPERATIONS HALL</small></div>
          <div className="rl-balcony rl-balcony--left"/>
          <div className="rl-balcony rl-balcony--right"/>
          <div className="rl-elevator rl-elevator--left"><b>ELEVATOR</b></div>
          <div className="rl-elevator rl-elevator--right"><b>ELEVATOR</b></div>
          <div className="rl-library"><b>KNOWLEDGE</b></div>
          <div className="rl-server"><b>OPS</b></div>
          <div className="rl-radar"><i/></div>
          <div className="rl-lounge"><span/><span/><span/></div>
          <div className="rl-frontdesk"><strong>RandApp Hub</strong><small>real-time ecosystem</small></div>
          <div className="rl-path rl-path--a"/>
          <div className="rl-path rl-path--b"/>
          <div className="rl-path rl-path--c"/>
          {board.map((agent)=><PixelBot key={agent.id} agent={agent}/>)}
        </div>
        <div className="rl-legend">
          <span><i className="run"/>RUNNING = si muove e lavora</span>
          <span><i className="idle"/>IDLE = resta alla postazione</span>
          <span><i className="wait"/>WAITING = attende</span>
          <span><i className="err"/>ERROR = allarme</span>
        </div>
      </div>

      <aside className="rl-side">
        <section><header><strong>Attività live</strong><span>{fmtTime(new Date())}</span></header>{activity.map((a)=><div className="rl-event" key={a.id}><i style={{background:TONES[a.id]}}/><div><b>{a.name}</b><p>{a.activity||agentStatusLabel(a.status)}</p></div><time>{fmtTime(a.heartbeatAt)}</time></div>)}{!activity.length&&<p className="rl-empty">Nessuna attività registrata.</p>}</section>
        <section><header><strong>Stato agenti</strong><span>{counts.ERROR? 'ATTENZIONE':'STABILE'}</span></header>{board.map((a)=><div className="rl-status" key={a.id}><span><i className={`s-${a.status.toLowerCase()}`}/>{a.name}</span><b>{agentStatusLabel(a.status)}</b></div>)}</section>
        {error&&<div className="rl-error">{error}</div>}
      </aside>
    </section>
  </main>
}
