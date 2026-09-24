import { useMemo, useState } from 'react'
import { Button } from './ui.jsx'
import OperationalDetailPage from './OperationalDetailPage.jsx'
import OperationalTimeline from './OperationalTimeline.jsx'
import { buildReminderTaskTimeline, buildUrgentTaskTimeline } from './task-supply-timeline.js'

export default function TaskResourceDetail({
  type,
  item,
  hotel,
  onBack,
  onTake,
  onComplete,
  onToggleReminder,
  onEditReminder,
  onDeleteReminder,
  onTransformUrgent,
}) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isUrgent = type === 'urgent'
  const events = useMemo(
    () => isUrgent ? buildUrgentTaskTimeline(item) : buildReminderTaskTimeline(item),
    [isUrgent, item],
  )

  const run = async (action) => {
    if (!action || busy) return
    setBusy(true)
    try { await action(); onBack?.() } finally { setBusy(false) }
  }

  const primaryAction = isUrgent
    ? item.status === 'aperta'
      ? { label: 'Prendi in carico', icon: 'check', busy, onClick: () => run(() => onTake?.(item)) }
      : item.status === 'presa_in_carico'
        ? { label: 'Completa avviso', icon: 'check', busy, onClick: () => run(() => onComplete?.(item)) }
        : null
    : onToggleReminder
      ? { label: item.active ? 'Metti in pausa' : 'Riattiva', icon: 'check', busy, onClick: () => run(() => onToggleReminder(item)) }
      : null

  return (
    <OperationalDetailPage
      kind="task"
      resourceId={`${type}:${item.id}`}
      title={isUrgent ? (item.location || 'Avviso') : 'Promemoria'}
      subtitle={hotel?.name || ''}
      onBack={onBack}
      primaryAction={primaryAction}
      className="rs-task-resource-detail"
    >
      <h2 className="rs-detail-room">{isUrgent ? (item.location || 'Avviso urgente') : item.message}</h2>
      {isUrgent ? <p className="rs-detail-desc">{item.note}</p> : (
        <>
          <p className="rs-detail-desc">{item.message}</p>
          <p className="rs-detail-origin">{(item.target_roles || []).join(', ') || 'Nessun ruolo'} · {(item.times || []).join(' · ') || 'Senza orario'}</p>
        </>
      )}
      <OperationalTimeline events={events} />

      {isUrgent && onTransformUrgent && item.status !== 'completata' && !item.transformed && (
        <div className="rs-actions-stack">
          <Button variant="ghost" icon="issues" onClick={() => onTransformUrgent(item)}>Trasforma in segnalazione</Button>
        </div>
      )}

      {!isUrgent && (
        <div className="rs-actions-stack">
          {onEditReminder && <Button variant="ghost" icon="edit" onClick={() => onEditReminder(item)}>Modifica promemoria</Button>}
          {onDeleteReminder && !confirmDelete && <Button variant="danger" icon="trash" onClick={() => setConfirmDelete(true)}>Elimina promemoria</Button>}
          {confirmDelete && (
            <div className="rs-note rs-note--waiting">
              <strong>Eliminare definitivamente questo promemoria?</strong>
              <div className="rs-form-actions">
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Annulla</Button>
                <Button variant="danger" disabled={busy} onClick={() => run(() => onDeleteReminder(item))}>Conferma elimina</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </OperationalDetailPage>
  )
}
