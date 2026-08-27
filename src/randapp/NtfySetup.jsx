import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseUrl } from '../supabase.js'
import { Button, Card } from './ui.jsx'

const ENABLE_PREFIX = 'apicehotel.ntfy.setup.v1.'
const VERIFIED_PREFIX = 'apicehotel.ntfy.verified.v1.'
const getStore = key => { try { return localStorage.getItem(key) } catch { return null } }
const setStore = (key,value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key,value) } catch {} }
const friendlyError = (error) => {
  const text = String(error?.message || error || '').trim()
  if (/load failed|failed to fetch|networkerror/i.test(text)) return 'Connessione al servizio ntfy non riuscita. Riprova tra qualche secondo.'
  if (/unauthorized|sessione/i.test(text)) return 'Sessione scaduta: esci e rientra in RandApp.'
  if (/topic_not_configured/i.test(text)) return 'Canale ntfy non configurato per questa struttura.'
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
  useEffect(()=>{ if(!enabled||!hotelId||config) return; let live=true; setBusy(true); setError(''); setStatus('Carico configurazione ntfy…'); invoke('ntfy-config',hotelId).then(c=>{if(!live)return;if(!c.enabled)throw new Error('Il canale ntfy è disattivato per questa struttura.');setConfig(c);setStatus('')}).catch(e=>{if(!live)return;setStatus('');setError(friendlyError(e))}).finally(()=>live&&setBusy(false)); return()=>{live=false} },[enabled,hotelId,config,reloadKey])

  const housekeeping=config?.channel==='housekeeping'
  const activate=()=>{setStore(enabledKey,'1');setEnabled(true);setError('')}
  const disable=()=>{setStore(enabledKey,null);setEnabled(false);setConfig(null);setStatus('');setError('')}
  const retry=()=>{setConfig(null);setError('');setStatus('');setReloadKey(v=>v+1)}
  const copy=async()=>{try{await navigator.clipboard.writeText(config.topic);setStatus('Topic copiato ✓')}catch{setError('Copia automatica non riuscita: seleziona il topic e copialo.') }}
  const test=async()=>{setBusy(true);setError('');setStatus('Invio notifica di prova…');try{await invoke('ntfy-alert',hotelId,{test:true,...(housekeeping?{channel:'housekeeping'}:{})});setStore(verifiedKey,new Date().toISOString());setVerified(true);setStatus(housekeeping?'Test inviato ✓ Riceverai qui le modifiche Housekeeping di Direzione e Reception.':'Test inviato ✓ Controlla ntfy: deve arrivare una notifica con priorità massima.')}catch(e){setError(friendlyError(e));setStatus('')}finally{setBusy(false)}}

  return <section className="rs-section" data-testid="ntfy-setup">
    <div className="rs-section__head"><h2>{housekeeping?'Notifiche Housekeeping ntfy':'Allarme esterno ntfy'}</h2>{verified&&<span className="rs-badge rs-badge--accent">Testato ✓</span>}</div>
    <Card className="rs-card--pad">
      <p className="rs-ntfy-intro">{housekeeping?'Canale riservato alla Capo Governante: riceve le modifiche Housekeeping effettuate da Direzione e Reception.':'Secondo canale indipendente per gli Avvisi Urgenti, oltre alle notifiche RandApp.'}</p>
      {!enabled ? <div className="rs-op-card__actions"><Button type="button" onClick={activate}>Attiva e configura ntfy</Button></div> : <>
        {config&&<>
          <div className="rs-ntfy-steps"><b>1. Installa ntfy</b><b>2. Aggiungi il topic</b><b>3. Prova la notifica</b></div>
          {config.apps&&<div className="rs-op-card__actions">{config.apps.ios&&<a className="rs-button rs-button--outline" href={config.apps.ios} target="_blank" rel="noreferrer">iPhone / iPad</a>}{config.apps.android&&<a className="rs-button rs-button--outline" href={config.apps.android} target="_blank" rel="noreferrer">Android</a>}{config.apps.web&&<a className="rs-button rs-button--outline" href={config.apps.web} target="_blank" rel="noreferrer">PC / Web</a>}</div>}
          <div className="rs-ntfy-topic"><small>{housekeeping?'Topic Housekeeping personale del ruolo — non condividerlo':'Topic della struttura — non condividerlo'}</small><code>{config.topic}</code><Button type="button" variant="outline" onClick={copy}>Copia topic</Button></div>
          <div className="rs-op-card__actions"><Button type="button" onClick={test} disabled={busy}>{verified?'Ripeti test ntfy':'Invia test ntfy'}</Button><Button type="button" variant="ghost" onClick={disable} disabled={busy}>Nascondi configurazione</Button></div>
        </>}
        {!config&&!error&&<p>{busy?'Caricamento…':'Configurazione non disponibile.'}</p>}
        {!config&&error&&<div className="rs-op-card__actions"><Button type="button" variant="outline" onClick={retry} disabled={busy}>Riprova configurazione</Button></div>}
      </>}
      {status&&<p className="rs-success" role="status">{status}</p>}{error&&<p className="rs-error" role="alert">{error}</p>}
    </Card>
  </section>
}
