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
  const [operations, setOperations] = useState(null)
  const [costEvidence, setCostEvidence] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [hours, setHours] = useState(24)

  const load = useCallback(async () => {
    if (!supabase || !accessHotels.length) return
    setBusy(true); setNotice('')
    const tasks = [supabase.rpc('randai_control_snapshot', { p_hotel_id: hotelFilter === 'all' ? null : hotelFilter, p_hours: hours })]
    if (mode === 'workers') tasks.push(supabase.rpc('randcore_operations_snapshot', { p_hours: hours }))
    if (mode === 'observability') tasks.push(supabase.rpc('randcore_observability_cost_snapshot', { p_hotel_id: hotelFilter === 'all' ? null : hotelFilter, p_hours: hours }))
    const results = await Promise.all(tasks)
    const [base, extra] = results
    if (base.error) setNotice(base.error.message || 'Centro controllo non disponibile.')
    else setData(base.data)
    if (extra?.error) setNotice((current) => current || extra.error.message || 'Dati RandCore non disponibili.')
    else if (mode === 'workers') setOperations(extra?.data || null)
    else if (mode === 'observability') setCostEvidence(extra?.data || null)
    setBusy(false)
  }, [accessHotels.join('|'), hotelFilter, hours, mode])

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

  const setWorkerActive = async (worker) => {
    if (!worker?.pauseable || worker?.jobid == null || busy) return
    setBusy(true); setNotice('')
    const nextActive = worker.active === false
    const { error } = await supabase.rpc('randcore_set_worker_active', { p_jobname: worker.jobname, p_active: nextActive })
    if (error) setNotice(error.message || 'Cambio stato worker non riuscito.')
    else setNotice(`${worker.jobname}: ${nextActive ? 'attivato' : 'messo in pausa'}.`)
    setBusy(false)
    await load()
  }

  const anomalies = data?.anomalies || []
  const counts = useMemo(() => anomalySummary(anomalies), [anomalies])
  const fallbackCost = observedCost(data?.observability)
  const generated = operations?.generated_at || data?.generated_at
  const workerRows = operations?.workers || data?.workers || []
  const measuredCost = costEvidence?.cost_usd == null ? null : Number(costEvidence.cost_usd)
  const costLabel = measuredCost == null ? 'non misurato' : `$${measuredCost.toFixed(4)}`

  const header = <div className="scc-head"><div><small>RAND CONTROL · OPERATIONS</small><h2>{mode === 'workers' ? 'Worker & automazioni' : mode === 'rules' ? 'Regole operative' : mode === 'anomalies' ? 'Anomalie' : mode === 'observability' ? 'Costi & osservabilità' : 'Audit operativo'}</h2><p>Dati verificati dal backend; nessun servizio o costo viene marcato come noto senza evidenza reale.</p></div><div className="scc-tools"><label>Finestra<select value={hours} onChange={(e) => setHours(Number(e.target.value))}><option value="6">6 ore</option><option value="24">24 ore</option><option value="72">3 giorni</option><option value="168">7 giorni</option></select></label><button onClick={load} disabled={busy}>{busy ? 'Aggiorno…' : 'Aggiorna'}</button></div></div>

  if (!data && !notice) return <div className="scc-shell">{header}<Empty>Caricamento centro controllo…</Empty></div>

  const workers = <>
    <div className="scc-kpis"><article><span>Worker registrati</span><strong>{workerRows.length}</strong><small>{operations?.unmanaged_count || 0} non censiti</small></article><article><span>Event-driven in attesa</span><strong>{operations?.event_driven_idle_count ?? '—'}</strong><small>non sono worker spenti</small></article><article><span>Anomalie</span><strong>{anomalies.length}</strong><small>{counts.high || 0} alte</small></article><article><span>Tracce RandAI</span><strong>{data?.observability?.trace_count ?? 0}</strong><small>ultime {hours} ore</small></article></div>
    <section className="scc-card"><header><strong>Registro canonico worker</strong><span>Timezone cron: {operations?.cron_timezone || data?.cron_timezone || 'UTC'}</span></header><div className="scc-worker-list">{workerRows.map((worker) => { const scheduled = worker.jobid != null; const health = scheduled ? workerHealth(worker) : { state: worker.event_driven ? '' : 'warn', label: worker.event_driven ? 'In attesa evento' : 'Non schedulato' }; const next = scheduled ? nextCronRun(worker.schedule, generated ? new Date(generated) : new Date()) : null; return <article key={worker.jobname}><div><strong>{worker.jobname}</strong><small>{worker.purpose || 'Worker non ancora censito'}{worker.owner_module ? ` · ${worker.owner_module}` : ''}{worker.kind ? ` · ${worker.kind}` : ''}</small><small>{scheduled ? `${worker.schedule} · ultimo ${fmt(worker.last_run?.start_time)} · prossimo ${next ? fmt(next) : 'non calcolabile'}` : `${worker.expected_schedule || 'event-driven'} · nessuna istanza attiva`}</small>{worker.notes && <p>{worker.notes}</p>}{worker.last_run?.return_message && health.state === 'bad' && <p>{worker.last_run.return_message}</p>}</div><div className="scc-actions"><Pill tone={worker.active === false ? 'warn' : health.state}>{worker.active === false ? 'In pausa' : health.label}</Pill><span>{worker.recent_failures || 0} errori/{hours}h</span>{worker.cost_class && <Pill>{worker.cost_class}</Pill>}{retryable.has(worker.jobname) && scheduled && worker.active !== false && <button onClick={() => retry(worker.jobname)} disabled={busy}>Retry sicuro</button>}{worker.pauseable && scheduled && <button onClick={() => setWorkerActive(worker)} disabled={busy}>{worker.active === false ? 'Riattiva' : 'Pausa'}</button>}</div></article> })}{!workerRows.length && <Empty>Nessun worker registrato.</Empty>}</div></section>
    <section className="scc-card"><header><strong>Policy operativa</strong><span>event-driven prima del polling</span></header><p>I worker temporanei per promemoria esistono solo quando c’è lavoro. Meteo e sensori mantengono le cadenze deliberate; la scadenza presenza è controllata ogni 5 minuti invece che ogni minuto perché la soglia operativa è 7h20.</p></section>
  </>

  const rules = <div className="scc-columns"><section className="scc-card"><header><strong>Action Gateway</strong><span>hotel-scoped</span></header><div className="scc-stack">{(data?.rules?.gateway || []).map((rule) => <article key={rule.hotel_id}><div><strong>{HOTEL[rule.hotel_id] || rule.hotel_id}</strong><small>Aggiornato {fmt(rule.updated_at)}</small></div><div><Pill tone={rule.enabled ? 'good' : 'bad'}>{rule.enabled ? 'Gateway attivo' : 'Gateway spento'}</Pill><Pill tone={rule.auto_execute_low_risk ? 'warn' : ''}>{rule.auto_execute_low_risk ? 'Auto low-risk' : 'Conferma richiesta'}</Pill></div></article>)}</div></section><section className="scc-card"><header><strong>Autonomia RandAI</strong><span>policy esistenti</span></header><div className="scc-stack">{(data?.rules?.autonomy || []).map((rule) => <article key={rule.id}><div><strong>{rule.id}</strong><small>Livello {rule.level || '—'} · rischio max {rule.max_risk || '—'}</small></div><div><Pill>{Array.isArray(rule.allowed_tools) ? `${rule.allowed_tools.length} tool consentiti` : 'policy'}</Pill></div></article>)}</div></section></div>

  const anomalyPanel = <section className="scc-card"><header><strong>Anomalie verificabili</strong><span>{anomalies.length} nella finestra</span></header><div className="scc-stack">{anomalies.map((item, index) => <article key={`${item.kind}-${item.time}-${index}`}><div><strong>{item.label || item.kind}</strong><small>{item.hotel_id ? (HOTEL[item.hotel_id] || item.hotel_id) : 'Sistema'} · {fmt(item.time)}</small>{item.detail && <p>{item.detail}</p>}</div><Pill tone={item.severity === 'high' ? 'bad' : 'warn'}>{item.severity || 'medium'}</Pill></article>)}{!anomalies.length && <Empty>Nessuna anomalia rilevata nella finestra selezionata.</Empty>}</div></section>

  const audit = <section className="scc-card"><header><strong>Audit unificato</strong><span>{data?.audit?.length || 0} eventi</span></header><div className="scc-table"><table><thead><tr><th>Ora</th><th>Hotel</th><th>Modulo</th><th>Azione</th><th>Esito</th><th>Ruolo</th></tr></thead><tbody>{(data?.audit || []).map((item) => <tr key={`${item.source}-${item.id}`}><td>{fmt(item.time)}</td><td>{HOTEL[item.hotel_id] || item.hotel_id || '—'}</td><td>{item.module || item.source}</td><td>{item.action || '—'}<small>{item.record_type ? `${item.record_type} · ${item.record_id || '—'}` : ''}</small></td><td><Pill tone={['success','executed','submitted','ok'].includes(String(item.status).toLowerCase()) ? 'good' : ['failed','error','denied','rejected'].includes(String(item.status).toLowerCase()) ? 'bad' : ''}>{item.status || '—'}</Pill></td><td>{item.actor_role || '—'}</td></tr>)}</tbody></table></div></section>

  const providers = costEvidence?.providers || []
  const observability = <><div className="scc-kpis"><article><span>Tracce</span><strong>{costEvidence?.trace_count ?? data?.observability?.trace_count ?? 0}</strong><small>{hours} ore</small></article><article><span>Tracce senza hotel</span><strong>{costEvidence?.unscoped_trace_count ?? '—'}</strong><small>devono diminuire nel tempo</small></article><article><span>Costi misurati</span><strong>{costEvidence?.cost_measured_count ?? '—'}</strong><small>tracce con cost_usd reale</small></article><article><span>Costo USD</span><strong>{costEvidence ? costLabel : fallbackCost.label}</strong><small>{costEvidence?.cost_measured_count ? 'misurato' : 'non stimato'}</small></article></div><section className="scc-card"><header><strong>Cost ledger evidence-only</strong><span>provider / modello</span></header><p>Il Centro controllo non ricostruisce listini e non stima costi mancanti: aggrega solo valori <code>cost_usd</code> e token registrati nelle tracce. Le tracce prive di hotel vengono conteggiate separatamente per evidenziare debito di osservabilità.</p>{providers.length ? <div className="scc-table"><table><thead><tr><th>Provider</th><th>Modello</th><th>Tracce</th><th>Costi misurati</th><th>USD</th><th>Token</th></tr></thead><tbody>{providers.map((row)=><tr key={`${row.provider}-${row.model}`}><td>{row.provider}</td><td>{row.model}</td><td>{row.trace_count}</td><td>{row.measured_cost_count}</td><td>{row.cost_usd == null ? '—' : Number(row.cost_usd).toFixed(4)}</td><td>{(Number(row.input_tokens||0)+Number(row.output_tokens||0))||'—'}</td></tr>)}</tbody></table></div> : <Empty>Nessuna evidenza provider/modello nella finestra selezionata.</Empty>}</section></>

  return <div className="scc-shell">{header}{notice && <div className="scc-notice">{notice}</div>}{mode === 'workers' ? workers : mode === 'rules' ? rules : mode === 'anomalies' ? anomalyPanel : mode === 'observability' ? observability : audit}</div>
}
