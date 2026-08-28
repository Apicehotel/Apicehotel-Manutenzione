import { useCallback, useEffect, useState } from 'react'
import { HOTELS } from '../../config.js'
import { supabase } from '../../supabase.js'
import { Button, Card, EmptyState, Spinner } from '../ui.jsx'

const number = (value) => new Intl.NumberFormat('it-IT').format(Number(value || 0))

function Stat({ label, value, hint }) {
  return <Card className="rs-card--pad"><div style={{display:'grid',gap:4}}><small style={{color:'var(--rs-text-2)'}}>{label}</small><strong style={{fontSize:'1.45rem'}}>{value}</strong>{hint&&<small style={{color:'var(--rs-text-3)'}}>{hint}</small>}</div></Card>
}

export default function UsageTab(){
  const [stats,setStats]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      if(!supabase) throw new Error('Supabase non configurato')
      const {data,error:rpcError}=await supabase.rpc('get_usage_stats')
      if(rpcError) throw rpcError
      setStats(data||{})
    }catch(err){setError(err?.message||'Impossibile leggere i consumi')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{load()},[load])
  if(loading&&!stats)return <Spinner label="Calcolo consumi RandApp…"/>
  if(error&&!stats)return <EmptyState icon="activity" title="Consumi non disponibili">{error}</EmptyState>
  const perHotel=stats?.per_hotel||{}
  return <section data-testid="settings-usage">
    <div className="rs-page-title"><div><h1>Consumi</h1><p>Utilizzo reale del database e volume operativo RandApp</p></div><Button variant="ghost" size="sm" icon="refresh" onClick={load} disabled={loading}>{loading?'Aggiorno…':'Aggiorna'}</Button></div>
    {error&&<p className="rs-badge rs-badge--waiting" role="status">{error}</p>}
    <div className="rs-diag-grid" style={{marginBottom:16}}>
      <Stat label="Database" value={stats?.db_size_pretty||'—'} hint="spazio PostgreSQL utilizzato"/>
      <Stat label="Utenti" value={number(stats?.utenti)}/>
      <Stat label="Segnalazioni" value={number(stats?.segnalazioni)}/>
      <Stat label="Interventi" value={number(stats?.interventi)}/>
      <Stat label="Planning lavori" value={number(stats?.planning_lavori)}/>
      <Stat label="Avvisi urgenti" value={number(stats?.richieste_urgenti)}/>
      <Stat label="Push attivi" value={number(stats?.push_subscriptions)} hint="subscription registrate"/>
    </div>
    <div className="rs-diag-section-head" style={{marginBottom:10}}><h3>Per struttura</h3><small>dati sempre separati per hotel</small></div>
    <div className="rs-diag-grid">
      {HOTELS.map(h=>{const s=perHotel[h.id]||{};return <Card className="rs-card--pad" key={h.id}><div style={{display:'grid',gap:10}}><strong>{h.name}</strong><div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}><div><small style={{color:'var(--rs-text-2)'}}>Segnalazioni</small><div><b>{number(s.segnalazioni)}</b></div></div><div><small style={{color:'var(--rs-text-2)'}}>Interventi</small><div><b>{number(s.interventi)}</b></div></div><div><small style={{color:'var(--rs-text-2)'}}>Urgenti</small><div><b>{number(s.richieste_urgenti)}</b></div></div></div></div></Card>})}
    </div>
    <p style={{color:'var(--rs-text-3)',fontSize:'.78rem',marginTop:16}}>Statistiche aggregate di RandApp. Nessun contenuto delle segnalazioni viene mostrato in questa vista.</p>
  </section>
}
