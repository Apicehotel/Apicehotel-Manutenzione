import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseUrl } from '../supabase.js'
import { Button, Card, Icon } from './ui.jsx'

const ENABLE_PREFIX = 'apicehotel.ntfy.setup.v2.'
const VERIFIED_PREFIX = 'apicehotel.ntfy.verified.v2.'
const getStore = key => { try { return localStorage.getItem(key) } catch { return null } }
const setStore = (key,value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key,value) } catch {} }
const friendlyError = (error) => {
  const text = String(error?.message || error || '').trim()
  if (/load failed|failed to fetch|networkerror/i.test(text)) return 'Connessione al servizio ntfy non riuscita. Riprova tra qualche secondo.'
  if (/unauthorized|sessione/i.test(text)) return 'Sessione scaduta: esci e rientra in RandApp.'
  if (/topic_not_configured/i.test(text)) return 'Canale ntfy non configurato per questa struttura.'
  if (/forbidden/i.test(text)) return 'Questo canale ntfy non è disponibile per il tuo ruolo.'
  return text || 'Configurazione ntfy non riuscita.'
}

async function invoke(name, hotelId, extra={}) {
  if (!supabase) throw new Error('Servizio notifiche non disponibile')
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error('Sessione RandApp non valida')
  const token=data?.session?.access_token
  if (!token) throw new Error('Sessione scaduta: esci e rientra in RandApp')
  const response=await fetch(`${supabaseUrl}/functions/v1/${encodeURIComponent(name)}`,{
    method:'POST',cache:'no-store',headers:{Authorization:`Bearer ${token}`,apikey:import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_Oiu7IOhuUd6YPEDmmSa7zA_ngNuiSlX','Content-Type':'application/json','X-RandApp-Request':`${Date.now()}-${Math.random().toString(36).slice(2)}`},body:JSON.stringify({hotel_id:hotelId,...extra})
  })
  let payload=null; try { payload=await response.json() } catch {}
  if(!response.ok) throw new Error(`${payload?.error || `HTTP ${response.status}`}${payload?.detail ? ` · ${payload.detail}` : ''}`)
  if(!payload?.ok) throw new Error(payload?.error || 'Operazione non riuscita')
  return payload
}

const channelIcon = id => id === 'urgent' ? 'warning' : id === 'housekeeping' ? 'housekeeping' : 'bell'

export default function NtfySetup({ hotelId }) {
  const enabledKey=useMemo(()=>`${ENABLE_PREFIX}${hotelId}`,[hotelId])
  const verifiedKey=useMemo(()=>`${VERIFIED_PREFIX}${hotelId}`,[hotelId])
  const [enabled,setEnabled]=useState(()=>getStore(enabledKey)==='1')
  const [verified,setVerified]=useState(()=>Boolean(getStore(verifiedKey)))
  const [config,setConfig]=useState(null)
  const [busy,setBusy]=useState(false)
  const [status,setStatus]=useState('')
  const [error,setError]=useState('')
  const [reloadKey,setReloadKey]=useState(0)

  useEffect(()=>{ setEnabled(getStore(enabledKey)==='1'); setVerified(Boolean(getStore(verifiedKey))); setConfig(null); setStatus(''); setError('') },[enabledKey,verifiedKey])
  useEffect(()=>{ if(!enabled||!hotelId||config) return; let live=true; setBusy(true); setError(''); setStatus('Carico notifiche ntfy…'); invoke('ntfy-config',hotelId).then(c=>{if(!live)return;if(!c.enabled)throw new Error('Nessun canale ntfy disponibile per questo ruolo.');setConfig(c);setStatus('')}).catch(e=>{if(!live)return;setStatus('');setError(friendlyError(e))}).finally(()=>live&&setBusy(false)); return()=>{live=false} },[enabled,hotelId,config,reloadKey])

  const channels=useMemo(()=>Array.isArray(config?.channels)&&config.channels.length?config.channels:(config?.topic?[{id:config.channel||'urgent',label:config.channel==='reminders'?'Promemoria':config.channel==='housekeeping'?'Housekeeping':'Avvisi urgenti',topic:config.topic,priority:5}]:[]),[config])
  const activate=()=>{setStore(enabledKey,'1');setEnabled(true);setError('')}
  const disable=()=>{setStore(enabledKey,null);setEnabled(false);setConfig(null);setStatus('');setError('')}
  const retry=()=>{setConfig(null);setError('');setStatus('');setReloadKey(v=>v+1)}
  const copy=async(channel)=>{try{await navigator.clipboard.writeText(channel.topic);setStatus(`${channel.label}: topic copiato ✓`)}catch{setError('Copia automatica non riuscita: tieni premuto sul topic e copialo.') }}
  const testAll=async()=>{
    if(!channels.length)return
    setBusy(true);setError('');setStatus(`Invio ${channels.length===1?'test':'test dei canali'}…`)
    try{
      for(const channel of channels) await invoke('ntfy-alert',hotelId,{test:true,channel:channel.id})
      setStore(verifiedKey,new Date().toISOString());setVerified(true)
      setStatus(channels.length===1?'Test inviato ✓ Controlla ntfy.':`${channels.length} test inviati ✓ In ntfy devono arrivare tutti i canali configurati.`)
    }catch(e){setError(friendlyError(e));setStatus('')}finally{setBusy(false)}
  }

  return <section className="rs-section" data-testid="ntfy-setup">
    <div className="rs-section__head"><h2>Notifiche ntfy</h2>{verified&&<span className="rs-badge rs-badge--accent">Testato ✓</span>}</div>
    <Card className="rs-card--pad">
      <p className="rs-ntfy-intro">Canale esterno indipendente da RandApp. Gli Avvisi Urgenti usano il canale della struttura; i Promemoria usano il canale del tuo ruolo.</p>
      {!enabled ? <div className="rs-op-card__actions"><Button type="button" onClick={activate}>Configura ntfy</Button></div> : <>
        {config&&<>
          <div className="rs-ntfy-steps"><b>1. Installa ntfy</b><b>2. Aggiungi i canali qui sotto</b><b>3. Prova le notifiche</b></div>
          {config.apps&&<div className="rs-op-card__actions">{config.apps.ios&&<a className="rs-button rs-button--outline" href={config.apps.ios} target="_blank" rel="noreferrer">iPhone / iPad</a>}{config.apps.android&&<a className="rs-button rs-button--outline" href={config.apps.android} target="_blank" rel="noreferrer">Android</a>}{config.apps.web&&<a className="rs-button rs-button--outline" href={config.apps.web} target="_blank" rel="noreferrer">PC / Web</a>}</div>}
          <div style={{display:'grid',gap:10,marginTop:12}}>{channels.map(channel=><div key={channel.id} className="rs-ntfy-topic" style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr) auto',alignItems:'center',gap:10}}><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:'var(--rs-cyan)'}}><Icon name={channelIcon(channel.id)}/></span><span style={{minWidth:0}}><strong style={{display:'block'}}>{channel.label}</strong><small style={{display:'block',color:'var(--rs-text-3)'}}>Priorità 5 · non condividere</small><code style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:4}}>{channel.topic}</code></span><Button type="button" variant="outline" size="sm" onClick={()=>copy(channel)}>Copia</Button></div>)}</div>
          <div className="rs-op-card__actions" style={{marginTop:14}}><Button type="button" onClick={testAll} disabled={busy}>{verified?'Ripeti test notifiche':'Prova notifiche'}</Button><Button type="button" variant="ghost" onClick={disable} disabled={busy}>Nascondi configurazione</Button></div>
        </>}
        {!config&&!error&&<p>{busy?'Caricamento…':'Configurazione non disponibile.'}</p>}
        {!config&&error&&<div className="rs-op-card__actions"><Button type="button" variant="outline" onClick={retry} disabled={busy}>Riprova configurazione</Button></div>}
      </>}
      {status&&<p className="rs-success" role="status">{status}</p>}{error&&<p className="rs-error" role="alert">{error}</p>}
    </Card>
  </section>
}
