import { useEffect, useMemo, useState } from 'react'
import { Button, Icon, Spinner } from '../ui.jsx'
import { fetchNotificationInbox, markAllNotificationsRead, markNotificationRead, subscribeNotificationInbox } from './notification-data.js'
import './notification-inbox.css'

const fmt = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}

export default function NotificationInbox({ hotel, user, onUnreadChange, canOpenUrgent, canManageReminders, onOpenUrgent, onOpenReminders }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  const load = async () => {
    if (!hotel?.id || !user?.role) return
    try {
      setError('')
      const result = await fetchNotificationInbox(hotel.id, user)
      setItems(result.items)
      onUnreadChange?.(result.unread)
    } catch (e) {
      setError(e?.message || 'Notifiche non disponibili')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    load()
    const off = subscribeNotificationInbox(hotel?.id, load)
    return () => off?.()
  }, [hotel?.id, user?.role])

  const shown = useMemo(() => items.filter((item) => filter === 'all' || item.type === filter), [items, filter])
  const unread = items.filter((x) => !x.read).length

  const openItem = async (item) => {
    if (!item.read) {
      try { await markNotificationRead(hotel.id, item) } catch {}
      setItems((list) => list.map((x) => x.key === item.key ? { ...x, read: true } : x))
      onUnreadChange?.(Math.max(0, unread - 1))
    }
  }

  const readAll = async () => {
    try { await markAllNotificationsRead(hotel.id, items) } catch {}
    setItems((list) => list.map((x) => ({ ...x, read: true })))
    onUnreadChange?.(0)
  }

  const iconFor = (type) => type === 'urgent' ? 'warning' : type === 'assignment' ? 'wrench' : 'bell'

  if (loading) return <Spinner label="Carico notifiche…" />

  return <div className="rs-inbox" data-testid="notification-inbox">
    <div className="rs-inbox__top">
      <div className="rs-inbox__tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tutte</button>
        <button className={filter === 'assignment' ? 'active' : ''} onClick={() => setFilter('assignment')}>Interventi</button>
        <button className={filter === 'urgent' ? 'active' : ''} onClick={() => setFilter('urgent')}>Urgenti</button>
        <button className={filter === 'reminder' ? 'active' : ''} onClick={() => setFilter('reminder')}>Promemoria</button>
      </div>
      {unread > 0 && <Button type="button" size="sm" variant="ghost" onClick={readAll}>Segna lette</Button>}
    </div>
    {error && <p className="rs-error">{error}</p>}
    {!shown.length ? <div className="rs-inbox__empty"><Icon name="bell" /><strong>Nessuna notifica</strong><small>Qui compariranno interventi assegnati, avvisi e promemoria destinati a te.</small></div> : <div className="rs-inbox__list">{shown.map((item) => <article key={item.key} className={`rs-inbox__item ${item.read ? '' : 'unread'}`} onClick={() => openItem(item)}>
      <div className={`rs-inbox__icon rs-inbox__icon--${item.type}`}><Icon name={iconFor(item.type)} /></div>
      <div className="rs-inbox__body">
        <div className="rs-inbox__title"><strong>{item.title}</strong><time>{fmt(item.at)}</time></div>
        <p>{item.message}</p>
        {item.meta && <small>{item.meta}</small>}
        {item.photo && <img src={item.photo} alt="Allegato notifica" loading="lazy" />}
        <div className="rs-inbox__actions">
          {item.type === 'urgent' && canOpenUrgent && <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openItem(item); onOpenUrgent?.() }}>Apri urgenti</Button>}
          {item.type === 'reminder' && canManageReminders && <Button type="button" size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openItem(item); onOpenReminders?.() }}>Gestisci</Button>}
        </div>
      </div>
      {!item.read && <span className="rs-inbox__dot" aria-label="Non letta" />}
    </article>)}</div>}
  </div>
}
