import { deletePlanningWorkDay, setPlanningWorkStatus } from '../../planning-work-data.js'
import { Icon } from '../ui.jsx'

export default function WorkRow({ item, user, onChanged }) {
  const done = item.status === 'done'
  const finish = item.status === 'da_finire'

  const act = async (status) => {
    await setPlanningWorkStatus(item.id, status, user?.name || '')
    onChanged?.()
  }

  const remove = async () => {
    await deletePlanningWorkDay(item.id)
    onChanged?.()
  }

  return (
    <article style={{ border: '1px solid var(--rs-line)', background: 'var(--rs-surface)', borderRadius: 16, padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
        <button type="button" onClick={() => act(done ? 'pending' : 'done')} aria-label={done ? 'Riapri lavoro' : 'Segna fatto'} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: done ? 'var(--rs-ok)' : finish ? 'var(--rs-warn)' : 'var(--rs-surface-2)', color: done ? 'white' : 'var(--rs-text)', fontSize: 20 }}>{done ? '✓' : '·'}</button>
        <div style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', textDecoration: done ? 'line-through' : 'none' }}>{item.description}</strong>
          {done && item.doneBy && <small style={{ display: 'block', marginTop: 4, color: 'var(--rs-ok)' }}>Fatto da {item.doneBy}{item.doneAt ? ` · ${new Date(item.doneAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}</small>}
          {finish && <small style={{ display: 'block', marginTop: 4, color: 'var(--rs-warn)', fontWeight: 800 }}>Da finire</small>}
        </div>
        <button type="button" className="rs-btn rs-btn--ghost" onClick={remove} aria-label="Elimina"><Icon name="trash" /></button>
      </div>
      {!done && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {finish
            ? <button type="button" className="rs-btn rs-btn--ghost" onClick={() => act('pending')}>Da fare</button>
            : <button type="button" className="rs-btn rs-btn--ghost" onClick={() => act('da_finire')}>Da finire</button>}
          <button type="button" className="rs-btn rs-btn--primary" onClick={() => act('done')}>✓ Fatto</button>
        </div>
      )}
    </article>
  )
}
