import { useEffect, useState } from 'react'
import { listImplementedRepositories, RepositoryUpdateStatus } from './repository-registry.js'

const label = {
  [RepositoryUpdateStatus.CURRENT]: 'Aggiornato',
  [RepositoryUpdateStatus.UPDATE_AVAILABLE]: 'Aggiornamento disponibile',
  [RepositoryUpdateStatus.MANAGED_HERE]: 'Gestito qui',
  [RepositoryUpdateStatus.CHECK_FAILED]: 'Check non riuscito',
}

export default function RepositoryRegistryPanel() {
  const [items, setItems] = useState(() => listImplementedRepositories())
  const [busy, setBusy] = useState(false)
  const [checkedAt, setCheckedAt] = useState(null)

  const check = async () => {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch('/api/randai/repository-updates', { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      setItems(payload.repositories || [])
      setCheckedAt(payload.checkedAt || new Date().toISOString())
    } catch {
      setItems((current) => current.map((item) => ({ ...item, status: item.tracking === 'managed-here' ? RepositoryUpdateStatus.MANAGED_HERE : RepositoryUpdateStatus.CHECK_FAILED })))
      setCheckedAt(new Date().toISOString())
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { check() }, [])

  return (
    <section className="randai__repo-registry" aria-label="Repository implementate">
      <div className="randai__repo-registry-head">
        <div>
          <b>Repository in uso</b>
          <small>Solo integrazioni verificate. Nessuna candidata RandRadar.</small>
        </div>
        <button type="button" onClick={check} disabled={busy}>{busy ? 'Controllo…' : 'Ricontrolla'}</button>
      </div>
      <div className="randai__repo-list">
        {items.map((item) => (
          <article key={item.id} className="randai__repo-item">
            <div>
              <strong>{item.name}</strong>
              <small>{item.project}</small>
            </div>
            <span data-status={item.status || 'UNCHECKED'}>{label[item.status] || 'Da controllare'}</span>
            <p>{item.usage}</p>
            <small>{item.repository}</small>
          </article>
        ))}
      </div>
      {checkedAt && <small className="randai__repo-checked">Ultimo check: {new Date(checkedAt).toLocaleString('it-IT')}</small>}
    </section>
  )
}
