import { useCallback, useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../../config.js'
import { supabase } from '../../supabase.js'
import { Button, Card, EmptyState, Icon, Spinner } from '../ui.jsx'
import './usage.css'

const number = (value) => new Intl.NumberFormat('it-IT').format(Number(value || 0))
const bytes = (value) => {
  const n = Number(value || 0)
  if (!n) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / (1024 ** i)).toFixed(i > 1 ? 1 : 0)} ${units[i]}`
}
const pct = (value, max) => max > 0 ? Math.max(0, Math.min(100, (Number(value || 0) / Number(max)) * 100)) : 0
const build = typeof __RANDAPP_BUILD__ !== 'undefined' ? __RANDAPP_BUILD__ : { sha:'dev', timestamp:null }

function StatusDot({ ok=true }) {
  return <span className={`rs-usage-dot ${ok ? 'ok' : 'warn'}`} aria-hidden="true" />
}

function Meter({ value, max, label }) {
  const p = pct(value,max)
  return <div className="rs-usage-meter" aria-label={`${label}: ${Math.round(p)}%`}>
    <span style={{width:`${p}%`}} />
  </div>
}

function ProviderMetric({ label, value, hint, meter }) {
  return <div className="rs-provider-metric">
    <small>{label}</small>
    <div className="rs-provider-metric__value"><strong>{value}</strong>{hint && <span>{hint}</span>}</div>
    {meter}
  </div>
}

function MiniStat({ icon, label, value, hint, tone='' }) {
  return <Card className={`rs-usage-mini ${tone ? `rs-usage-mini--${tone}` : ''}`}>
    <span className="rs-usage-mini__icon"><Icon name={icon}/></span>
    <div><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</div>
  </Card>
}

function ActivityChart({ data=[] }) {
  const series = data.map((d) => Number(d.segnalazioni || 0) + Number(d.interventi || 0))
  const max = Math.max(1, ...series)
  const width = 420
  const height = 122
  const pad = 8
  const points = series.map((v,i) => {
    const x = pad + (i * (width - pad * 2) / Math.max(1, series.length - 1))
    const y = height - pad - (v / max) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const last = data[data.length - 1]
  const total = series.reduce((a,b)=>a+b,0)
  return <Card className="rs-usage-chart">
    <div className="rs-usage-section-head"><div><strong>Andamento</strong><small>ultimi 30 giorni · segnalazioni + interventi</small></div><b>{number(total)}</b></div>
    <div className="rs-usage-chart__plot" role="img" aria-label={`Attività ultimi 30 giorni: ${total} eventi`}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs><linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".26"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
        <path className="rs-usage-chart__grid" d="M8 30H412M8 61H412M8 92H412" />
        {points && <><polygon className="rs-usage-chart__area" points={`${pad},${height-pad} ${points} ${width-pad},${height-pad}`} fill="url(#usageFill)"/><polyline className="rs-usage-chart__line" points={points}/></>}
      </svg>
    </div>
    <div className="rs-usage-chart__footer"><span>30 giorni fa</span><span>{last?.date ? new Date(`${last.date}T12:00:00`).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit'}) : 'oggi'}</span></div>
  </Card>
}

export default function UsageTab(){
  const [stats,setStats]=useState(null)
  const [vercel,setVercel]=useState({ok:null,ms:null})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [checkedAt,setCheckedAt]=useState(null)

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      if(!supabase) throw new Error('Supabase non configurato')
      const vercelCheck = (async()=>{
        if(typeof window === 'undefined') return {ok:false,ms:null}
        const started = performance.now()
        try {
          const response = await fetch(`${window.location.origin}/?randapp-health=${Date.now()}`, { cache:'no-store', headers:{'X-RandApp-Health':'1'} })
          return {ok:response.ok,ms:Math.round(performance.now()-started)}
        } catch { return {ok:false,ms:null} }
      })()
      const [{data,error:rpcError},nextVercel]=await Promise.all([supabase.rpc('get_usage_stats'),vercelCheck])
      if(rpcError) throw rpcError
      setStats(data||{})
      setVercel(nextVercel)
      setCheckedAt(new Date())
    }catch(err){setError(err?.message||'Impossibile leggere i consumi')}
    finally{setLoading(false)}
  },[])

  useEffect(()=>{load()},[load])
  const perHotel=stats?.per_hotel||{}
  const activity=stats?.activity_30d||[]
  const supabaseOk=Boolean(stats)
  const allOk=supabaseOk && vercel.ok !== false
  const photoShare=useMemo(()=>pct(stats?.maintenance_photos_bytes,stats?.storage_bytes),[stats])

  if(loading&&!stats)return <Spinner label="Calcolo consumi RandApp…"/>
  if(error&&!stats)return <EmptyState icon="activity" title="Consumi non disponibili">{error}</EmptyState>

  return <section className="rs-usage" data-testid="settings-usage">
    <div className="rs-page-title rs-usage-title"><div><h1>Consumi</h1><p>Infrastruttura Pro e volume operativo RandApp</p></div><Button variant="ghost" size="sm" icon="refresh" onClick={load} disabled={loading}>{loading?'Aggiorno…':'Aggiorna'}</Button></div>
    {error&&<p className="rs-badge rs-badge--waiting" role="status">{error}</p>}

    <Card className={`rs-usage-overall ${allOk?'is-ok':'is-warn'}`}>
      <div className="rs-usage-overall__mark"><Icon name={allOk?'check':'warning'}/></div>
      <div className="rs-usage-overall__copy"><strong>{allOk?'Tutto operativo':'Controllo richiesto'}</strong><span>{allOk?'Supabase e Vercel rispondono correttamente':'Uno dei servizi non ha risposto al controllo'}</span></div>
      <div className="rs-usage-overall__time"><small>Ultimo check</small><b>{checkedAt?checkedAt.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'—'}</b></div>
    </Card>

    <div className="rs-provider-grid">
      <Card className="rs-provider rs-provider--supabase">
        <div className="rs-provider-head"><div className="rs-provider-brand"><span className="rs-provider-logo rs-provider-logo--supabase">S</span><div><strong>Supabase</strong><span><StatusDot ok={supabaseOk}/>{supabaseOk?'Operativo':'Non disponibile'}</span></div></div><span className="rs-provider-plan">PRO</span></div>
        <div className="rs-provider-body">
          <ProviderMetric label="Database PostgreSQL" value={stats?.db_size_pretty||'—'} hint="utilizzati" />
          <ProviderMetric label="Connessioni DB" value={`${number(stats?.db_connections)} / ${number(stats?.db_max_connections)}`} hint={`${Math.round(pct(stats?.db_connections,stats?.db_max_connections))}%`} meter={<Meter value={stats?.db_connections} max={stats?.db_max_connections} label="Connessioni database"/>}/>
          <ProviderMetric label="Storage" value={bytes(stats?.storage_bytes)} hint={`${number(stats?.storage_files)} file`} />
          <ProviderMetric label="Foto manutenzione" value={bytes(stats?.maintenance_photos_bytes)} hint={`${number(stats?.maintenance_photos_files)} file · ${Math.round(photoShare)}% storage`} meter={<Meter value={stats?.maintenance_photos_bytes} max={stats?.storage_bytes} label="Quota foto manutenzione sullo storage"/>}/>
        </div>
        <div className="rs-provider-foot"><span><Icon name="activity"/>Realtime</span><b>Attivo</b><span>eu-central-1</span></div>
      </Card>

      <Card className="rs-provider rs-provider--vercel">
        <div className="rs-provider-head"><div className="rs-provider-brand"><span className="rs-provider-logo rs-provider-logo--vercel"/><div><strong>Vercel</strong><span><StatusDot ok={vercel.ok!==false}/>{vercel.ok===false?'Non raggiungibile':'Produzione online'}</span></div></div><span className="rs-provider-plan rs-provider-plan--vercel">PRO</span></div>
        <div className="rs-provider-body">
          <ProviderMetric label="Deploy corrente" value={build.sha||'dev'} hint="main · production" />
          <ProviderMetric label="Risposta hosting" value={vercel.ms!=null?`${vercel.ms} ms`:'—'} hint="controllo live" />
          <ProviderMetric label="Framework" value="Vite" hint="RandApp PWA" />
          <ProviderMetric label="Dominio" value="apicehotel.vercel.app" hint="CDN / Edge Vercel" />
        </div>
        <div className="rs-provider-foot"><span><Icon name="activity"/>Hosting</span><b>{vercel.ok===false?'Attenzione':'READY'}</b><span>Pro</span></div>
      </Card>
    </div>

    <div className="rs-usage-section-head"><div><strong>Volume operativo RandApp</strong><small>conteggi reali del database</small></div></div>
    <div className="rs-usage-mini-grid">
      <MiniStat icon="users" label="Utenti" value={number(stats?.utenti)} tone="cyan"/>
      <MiniStat icon="issues" label="Segnalazioni" value={number(stats?.segnalazioni)} tone="amber"/>
      <MiniStat icon="wrench" label="Interventi" value={number(stats?.interventi)} tone="blue"/>
      <MiniStat icon="calendar" label="Planning" value={number(stats?.planning_lavori)}/>
      <MiniStat icon="bell" label="Urgenti" value={number(stats?.richieste_urgenti)} tone="danger"/>
      <MiniStat icon="activity" label="Push attivi" value={number(stats?.push_subscriptions)} hint="subscription" tone="green"/>
    </div>

    <ActivityChart data={activity}/>

    <div className="rs-usage-section-head"><div><strong>Per struttura</strong><small>isolamento multi-hotel</small></div></div>
    <div className="rs-usage-hotels">
      {HOTELS.map(h=>{const s=perHotel[h.id]||{};return <Card className="rs-usage-hotel" key={h.id}>
        <div className="rs-usage-hotel__head"><img src={h.card} alt=""/><div><strong>{h.short}</strong><small>{h.name}</small></div></div>
        <div className="rs-usage-hotel__stats"><span><small>Segnalazioni</small><b>{number(s.segnalazioni)}</b></span><span><small>Interventi</small><b>{number(s.interventi)}</b></span><span><small>Urgenti</small><b>{number(s.richieste_urgenti)}</b></span></div>
      </Card>})}
    </div>

    <Card className="rs-usage-note"><Icon name="shield"/><div><strong>Dati amministrativi protetti</strong><span>Questa vista mostra solo metriche aggregate. Nessun contenuto delle segnalazioni viene esposto.</span></div></Card>
  </section>
}
