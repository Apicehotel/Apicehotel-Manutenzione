import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { anomalySummary, nextCronRun, observedCost, workerHealth } from './control-center-core.js'
import './system-control-console.css'

const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const HOTEL = { hotelgio: 'Hotel Giò', chocohotel: 'Chocohotel', brigantino: 'Il Brigantino' }
const retryable = new Set(['weather-alert-worker-2h-daytime', 'sync-sensori-temperatura-secure'])

function Pill({ tone = '', children }) { return <span className={`scc-pill ${tone}`}>{children}</span> }
function Empty({ children }) { return <div className="scc-empty">{children}</div> }

export default function SystemControlConsole({ accessHotels = [], hotelFilter = 'all', mode = 'workers' }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [hours, setHours] = useState(24)

  const load = useCallback(async () => {
    if (!supabase || !accessHotels.length) return
    setBusy(true); setNotice('')
    const { data: snapshot, error } = await supabase.rpc('randai_control_snapshot', { p_hotel_id: hotelFilter === 'all' ? null : hotelFilter, p_hours: hours })
    if (error) setNotice(error.message || 'Centro controllo non disponibile.')
    else setData(snapshot)
    setBusy(false)
  }, [accessHotels.join('|'), hotelFilter, hours])

  useEffect(() => { load() }, [load])

  const retry = async (jobname) => {
    if (!retryable.has(jobname) || busy) return
    setBusy(true); setNotice('')
    const { data: result, error } = await supabase.rpc('randai_retry_worker', { p_jobname: jobname })
    if (error) setNotice(error.message || 'Retry non riuscito.')
    else setNotice(`Retry inviato${result?.request_id ? ` · richiesta ${result.request_id}` : ''}.`)
    setBusy(false)
    await load()
  }

  const anomalies = data?.anomalies || []
  const counts = useMemo(() => anomalySummary(anomalies), [anomalies])
  const cost = observedCost(data?.observability)
  const generated = data?.generated_at

  const header = <div className="scc-head"><div><small>PUNTO 5 · CENTRO CONTROLLO</small><h2>{mode === 'workers' ? 'Worker & stato servizi' : mode === 'rules' ? 'Regole operative' : mode === 'anomalies' ? 'Anomalie' : mode === 'observability' ? 'Costi & osservabilità' : 'Audit operativo'}</h2><p>Dati verificati dal backend; nessun servizio viene marcato online senza una sorgente reale.</p></div><div className="scc-tools"><label>Finestra<select value={hours} onChange={(e) => setHours(Number(e.target.value))}><option value="6">6 ore</option><option value="24">24 ore</option><option value="72">3 giorni</option><option value="168">7 giorni</option></select></label><button onClick={load} disabled={busy}>{busy ? 'Aggiorno…' : 'Aggiorna'}</button></div></div>

  if (!data && !notice) return <div className="scc-shell">{header}<Empty>Caricamento centro controllo…</Empty></div>

  const workers = <>
    <div className="scc-kpis"><article><span>Worker attivi</span><strong>{data?.workers?.length || 0}</strong><small>letti da pg_cron</small></article><article><span>Anomalie</span><strong>{anomalies.length}</strong><small>{counts.high || 0} alte</small></article><article><span>Knowledge gap</span><strong>{data?.knowledge?.gaps_open ?? 0}</strong><small>{data?.knowledge?.approved ?? 0} procedure approvate</small></article><article><span>Tracce RandAI</span><strong>{data?.observability?.trace_count ?? 0}</strong><small>ultime {hours} ore</small></article></div>
    <section className="scc-card"><header><strong>Scheduler reale</strong><span>Timezone cron: {data?.cron_timezone || 'UTC'}</span></header><div className="scc-worker-list">{(data?.workers || []).map((worker) => { const health = workerHealth(worker); const next = nextCronRun(worker.schedule, generated ? new Date(generated) : new Date()); return <article key={worker.jobid}><div><strong>{worker.jobname}</strong><small>{worker.schedule} · ultimo {fmt(worker.last_run?.start_time)} · prossimo {next ? fmt(next) : 'non calcolabile'}</small>{worker.last_run?.return_message && health.state === 'bad' && <p>{worker.last_run.return_message}</p>}</div><div className="scc-actions"><Pill tone={health.state}>{health.label}</Pill><span>{worker.recent_failures || 0} errori/{hours}h</span>{retryable.has(worker.jobname) && <button onClick={() => retry(worker.jobname)} disabled={busy}>Retry sicuro</button>}</div></article> })}{!data?.workers?.length && <Empty>Nessun job attivo.</Empty>}</div></section>
    <section className="scc-card"><header><strong>Stato operativo</strong><span>supervisor / eval</span></header><div className="scc-grid"><div><span>Supervisor run</span><strong>{data?.supervisor?.recent ?? 0}</strong><small>{data?.supervisor?.errors ?? 0} errori</small></div><div><span>Eval</span><strong>{data?.evals?.recent ?? 0}</strong><small>{data?.evals?.failed ?? 0} fallite</small></div><div><span>Bozze procedure</span><strong>{data?.knowledge?.draft ?? 0}</strong><small>non sono conoscenza approvata</small></div><div><span>Costo misurato</span><strong>{cost.label}</strong><small>{cost.available ? 'dato provider presente nelle tracce' : 'nessuna cifra inventata'}</small></div></div></section>
  </>

  const rules = <div className="scc-columns"><section className="scc-card"><header><strong>Action Gateway</strong><span>hotel-scoped</span></header><div className="scc-stack">{(data?.rules?.gateway || []).map((rule) => <article key={rule.hotel_id}><div><strong>{HOTEL[rule.hotel_id] || rule.hotel_id}</strong><small>Aggiornato {fmt(rule.updated_at)}</small></div><div><Pill tone={rule.enabled ? 'good' : 'bad'}>{rule.enabled ? 'Gateway attivo' : 'Gateway spento'}</Pill><Pill tone={rule.auto_execute_low_risk ? 'warn' : ''}>{rule.auto_execute_low_risk ? 'Auto low-risk' : 'Conferma richiesta'}</Pill></div></article>)}</div></section><section className="scc-card"><header><strong>Autonomia RandAI</strong><span>policy esistenti</span></header><div className="scc-stack">{(data?.rules?.autonomy || []).map((rule) => <article key={rule.id}><div><strong>{rule.id}</strong><small>Livello {rule.level || '—'} · rischio max {rule.max_risk || '—'}</small></div><div><Pill>{Array.isArray(rule.allowed_tools) ? `${rule.allowed_tools.length} tool consentiti` : 'policy'}</Pill></div></article>)}</div></section></div>

  const anomalyPanel = <section className="scc-card"><header><strong>Anomalie verificabili</strong><span>{anomalies.length} nella finestra</span></header><div className="scc-stack">{anomalies.map((item, index) => <article key={`${item.kind}-${item.time}-${index}`}><div><strong>{item.label || item.kind}</strong><small>{item.hotel_id ? (HOTEL[item.hotel_id] || item.hotel_id) : 'Sistema'} · {fmt(item.time)}</small>{item.detail && <p>{item.detail}</p>}</div><Pill tone={item.severity === 'high' ? 'bad' : 'warn'}>{item.severity || 'medium'}</Pill></article>)}{!anomalies.length && <Empty>Nessuna anomalia rilevata nella finestra selezionata.</Empty>}</div></section>

  const audit = <section className="scc-card"><header><strong>Audit unificato</strong><span>{data?.audit?.length || 0} eventi</span></header><div className="scc-table"><table><thead><tr><th>Ora</th><th>Hotel</th><th>Modulo</th><th>Azione</th><th>Esito</th><th>Ruolo</th></tr></thead><tbody>{(data?.audit || []).map((item) => <tr key={`${item.source}-${item.id}`}><td>{fmt(item.time)}</td><td>{HOTEL[item.hotel_id] || item.hotel_id || '—'}</td><td>{item.module || item.source}</td><td>{item.action || '—'}<small>{item.record_type ? `${item.record_type} · ${item.record_id || '—'}` : ''}</small></td><td><Pill tone={['success','executed','submitted','ok'].includes(String(item.status).toLowerCase()) ? 'good' : ['failed','error','denied','rejected'].includes(String(item.status).toLowerCase()) ? 'bad' : ''}>{item.status || '—'}</Pill></td><td>{item.actor_role || '—'}</td></tr>)}</tbody></table></div></section>

  const observability = <><div className="scc-kpis"><article><span>Tracce</span><strong>{data?.observability?.trace_count ?? 0}</strong><small>{hours} ore</small></article><article><span>Input token</span><strong>{data?.observability?.input_tokens ?? 0}</strong><small>solo se registrati</small></article><article><span>Output token</span><strong>{data?.observability?.output_tokens ?? 0}</strong><small>solo se registrati</small></article><article><span>Costo USD</span><strong>{cost.label}</strong><small>{cost.available ? 'misurato' : 'provider non registrato'}</small></article></div><section className="scc-card"><header><strong>Regola costi</strong><span>evidence-only</span></header><p>Il Centro controllo mostra un costo soltanto quando una traccia contiene un valore provider esplicito <code>cost_usd</code>. I token mancanti valgono “non registrati”, non vengono stimati da modelli o listini.</p></section></>

  return <div className="scc-shell">{header}{notice && <div className="scc-notice">{notice}</div>}{mode === 'workers' ? workers : mode === 'rules' ? rules : mode === 'anomalies' ? anomalyPanel : mode === 'observability' ? observability : audit}</div>
}
