import { useEffect, useMemo, useState } from 'react'
import { fetchShareableProcedures, shareProcedureToGroup } from './chat-data.js'

export default function ProcedurePicker({ open, groupId, onClose, onShared }) {
  const [procedures, setProcedures] = useState([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !groupId) return
    setError('')
    fetchShareableProcedures(groupId).then(setProcedures).catch((e) => setError(e.message || 'Procedure non disponibili'))
  }, [open, groupId])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return procedures
    return procedures.filter((p) => `${p.title} ${p.summary} ${p.category}`.toLowerCase().includes(needle))
  }, [procedures, query])

  if (!open) return null
  const share = async (procedure) => {
    setBusy(true); setError('')
    try {
      const messageId = await shareProcedureToGroup(groupId, procedure.id)
      onShared?.(messageId); onClose?.()
    } catch (e) { setError(e.message || 'Condivisione procedura non riuscita') }
    finally { setBusy(false) }
  }

  return <div className="rc-modal-backdrop" onClick={onClose}>
    <section className="rc-modal" onClick={(e) => e.stopPropagation()}>
      <header><div><h2>Condividi procedura</h2><small>Solo procedure approvate della struttura del gruppo.</small></div><button className="rc-icon" onClick={onClose}>×</button></header>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca procedura…" autoFocus />
      {error && <div className="rc-error" role="alert">{error}</div>}
      <div className="rc-member-list">
        {rows.map((procedure) => <div className="rc-member" key={procedure.id}>
          <span><b>{procedure.title}</b><small>{procedure.category || 'Generale'} · v{procedure.version} · rischio {procedure.risk_level || 'normal'}</small><small>{procedure.summary}</small></span>
          <button disabled={busy} onClick={() => share(procedure)}>Condividi</button>
        </div>)}
        {!rows.length && !error && <p className="rc-muted">Nessuna procedura approvata disponibile.</p>}
      </div>
    </section>
  </div>
}
