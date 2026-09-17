import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { agentStatusLabel, buildAgentRuntimeBoard } from '../control-center/agent-registry.js'
import './agent-control.css'

const STATUS_TONE = {
  RUNNING: 'good',
  IDLE: 'good',
  WAITING_APPROVAL: 'warn',
  ERROR: 'bad',
  OFFLINE: 'neutral',
}

function fmt(value) {
  if (!value) return 'Mai'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function AgentCard({ agent, onToggle, busyId }) {
  const paused = agent.desiredState === 'PAUSED'
  return <article className={`rac-agent rac-agent--${STATUS_TONE[agent.status] || 'neutral'}`} data-agent-id={agent.id}>
    <header>
      <div><span className="rac-dot" aria-hidden="true" /><div><strong>{agent.name}</strong><small>{agent.role}</small></div></div>
      <span className="rac-status">{agentStatusLabel(agent.status)}</span>
    </header>
    <dl>
      <div><dt>Autonomia</dt><dd>{agent.autonomy}</dd></div>
      <div><dt>Ultimo heartbeat</dt><dd>{fmt(agent.heartbeatAt)}</dd></div>
      <div><dt>Task</dt><dd>{agent.taskId || '—'}</dd></div>
      <div><dt>Hotel</dt><dd>{agent.hotelId || 'Globale'}</dd></div>
    </dl>
    <p className="rac-activity">{agent.activity || (agent.status === 'OFFLINE' ? 'Nessun heartbeat recente.' : 'Nessuna attività dichiarata.')}</p>
    {agent.detail && <p className="rac-detail">{agent.detail}</p>}
    <footer>
      <span>Richiesta: <b>{paused ? 'PAUSA' : 'ATTIVO'}</b></span>
      <button type="button" onClick={() => onToggle(agent)} disabled={busyId === agent.id}>{busyId === agent.id ? 'Salvo…' : paused ? 'Riprendi' : 'Pausa'}</button>
    </footer>
  </article>
}

export default function AgentControlPanel() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase non configurato.'); setLoading(false); return }
    const { data, error: queryError } = await supabase.from('randcore_agent_runtime').select('agent_id,status,desired_state,heartbeat_at,task_id,activity,detail,hotel_id,updated_at').order('agent_id')
    if (queryError) { setError(queryError.message); setRows([]) }
    else { setError(''); setRows(data || []) }
    setLoading(false)
    setNow(Date.now())
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    if (!supabase) return () => window.clearInterval(timer)
    const channel = supabase.channel('randcore-agent-runtime-ui').on('postgres_changes', { event: '*', schema: 'public', table: 'randcore_agent_runtime' }, load).subscribe()
    return () => { window.clearInterval(timer); supabase.removeChannel(channel) }
  }, [load])

  const board = useMemo(() => {
    const normalized = rows.map((row) => ({
      ...row,
      agentId: row.agent_id,
      heartbeatAt: row.heartbeat_at,
      taskId: row.task_id,
      hotelId: row.hotel_id,
      updatedAt: row.updated_at,
    }))
    const base = buildAgentRuntimeBoard(normalized, now)
    const desired = new Map(rows.map((row) => [row.agent_id, row.desired_state || 'RUNNING']))
    return base.map((agent) => ({ ...agent, desiredState: desired.get(agent.id) || 'RUNNING' }))
  }, [rows, now])

  const counts = useMemo(() => board.reduce((acc, agent) => { acc[agent.status] = (acc[agent.status] || 0) + 1; return acc }, {}), [board])

  const toggle = async (agent) => {
    if (!supabase) return
    setBusyId(agent.id); setError('')
    const desired_state = agent.desiredState === 'PAUSED' ? 'RUNNING' : 'PAUSED'
    const { error: updateError } = await supabase.from('randcore_agent_runtime').update({ desired_state, updated_at: new Date().toISOString() }).eq('agent_id', agent.id)
    if (updateError) setError(updateError.message)
    else await load()
    setBusyId('')
  }

  return <div className="rac-shell">
    <section className="rac-summary">
      <div><span>Agenti registrati</span><strong>{board.length}</strong></div>
      <div><span>In esecuzione</span><strong>{counts.RUNNING || 0}</strong></div>
      <div><span>Attesa approvazione</span><strong>{counts.WAITING_APPROVAL || 0}</strong></div>
      <div><span>Errori</span><strong>{counts.ERROR || 0}</strong></div>
      <div><span>Offline</span><strong>{counts.OFFLINE || 0}</strong></div>
    </section>
    <div className="rac-head"><div><small>RUNTIME RANDAI</small><h2>Agenti IA</h2><p>Stati derivati da heartbeat reali. Se non arriva un heartbeat per 5 minuti l'agente risulta offline.</p></div><button type="button" onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : 'Aggiorna'}</button></div>
    {error && <div className="rac-error">{error}</div>}
    <div className="rac-grid">{board.map((agent) => <AgentCard key={agent.id} agent={agent} onToggle={toggle} busyId={busyId} />)}</div>
    <p className="rac-note">Pausa/Riprendi imposta lo stato desiderato nel registro centrale. I worker devono rispettarlo prima di iniziare nuovi task; non vengono interrotti processi già in fase critica.</p>
  </div>
}
