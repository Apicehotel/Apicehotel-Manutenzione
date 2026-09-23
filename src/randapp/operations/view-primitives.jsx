export { PageTitle } from '../randui/visual-primitives.jsx'

export const fmt = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

export const whatsappLink = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '')
  return digits ? `https://wa.me/${digits.replace(/^\+/, '')}` : null
}

function statusTone(status) {
  if (['done', 'completata'].includes(status)) return 'done'
  if (['presa_in_carico', 'in_progress', 'tecnico'].includes(status)) return 'tecnico'
  if (['da_finire', 'waiting'].includes(status)) return 'waiting'
  return 'todo'
}

export function StatusPill({ status }) {
  const labels = { pending: 'Da fare', todo: 'Da fare', in_progress: 'In corso', da_finire: 'Da finire', waiting: 'In attesa pezzo', tecnico: 'In attesa tecnico', done: 'Fatto', aperta: 'Aperta', presa_in_carico: 'Presa in carico', completata: 'Completata' }
  return <span className={`rs-badge rs-badge--${statusTone(status)}`}>{labels[status] || status}</span>
}

export function isAssignedTo(item, user) {
  const name = String(user?.name || '').trim().toLowerCase()
  if (!name) return false
  return (item.assignees || []).some((a) => String(a?.name || a || '').trim().toLowerCase() === name)
}


export function InterventionTags({ item }) {
  const category = item?.category || 'Manutenzione'
  return (
    <div
      data-testid="intervention-tags"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 10 }}
    >
      <span className="rs-badge rs-badge--info">{category}</span>
      <StatusPill status={item?.status || 'pending'} />
    </div>
  )
}
