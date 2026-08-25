import { useEffect, useMemo, useRef, useState } from 'react'
import { hotelGioClient } from '../hotelgio-data.js'
import { fetchDirectory } from '../users-data.js'
import { loadSession } from '../session.js'
import { hotelById } from './helpers.js'

const SESSION_EVENT = 'apice-session-changed'
const isReception = (user) => user?.role === 'Reception' || user?.department === 'Reception'
const roomLabel = (row) => `Camera ${row?.camera || '—'}`
const timeLabel = (value) => {
  const date = new Date(value || Date.now())
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

export default function HousekeepingCompletionAlerts() {
  const [session, setSession] = useState(loadSession())
  const [user, setUser] = useState(null)
  const [queue, setQueue] = useState([])
  const [openList, setOpenList] = useState(false)
  const seen = useRef(new Set())
  const hotel = hotelById(session?.hotelId)
  const enabled = Boolean(session?.hotelId && isReception(user))

  useEffect(() => {
    const onSessionChange = () => setSession(loadSession())
    window.addEventListener(SESSION_EVENT, onSessionChange)
    return () => window.removeEventListener(SESSION_EVENT, onSessionChange)
  }, [])

  useEffect(() => {
    let active = true
    setUser(null)
    if (!session?.hotelId || !session?.userId) return () => { active = false }
    fetchDirectory(session.hotelId).then(({ users }) => {
      if (!active) return
      const rows = users || []
      setUser(rows.find((row) => row.auth_user_id === session.userId || row.id === session.userId || row.legacy_id === session.userId) || null)
    }).catch(() => { if (active) setUser(null) })
    return () => { active = false }
  }, [session?.hotelId, session?.userId])

  useEffect(() => {
    setQueue([])
    setOpenList(false)
    seen.current.clear()
    if (!enabled) return undefined

    const addRow = (row, version) => {
      const key = `${row.id || `${row.hotel_id}:${row.work_date}:${row.camera}`}:${version || row.updated_at || row.completed_at || ''}`
      if (seen.current.has(key)) return
      seen.current.add(key)
      setQueue((current) => [...current.slice(-9), row])
    }

    const channel = hotelGioClient
      .channel(`randapp-hk-completions-${session.hotelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'housekeeping_completions',
        filter: `hotel_id=eq.${session.hotelId}`,
      }, (payload) => addRow(payload.new || {}, payload.new?.completed_at))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'housekeeping_completions',
        filter: `hotel_id=eq.${session.hotelId}`,
      }, (payload) => addRow(payload.new || {}, payload.new?.updated_at))
      .subscribe()

    return () => { hotelGioClient.removeChannel(channel) }
  }, [enabled, session?.hotelId])

  const latest = queue[queue.length - 1]
  const summary = useMemo(() => {
    if (!queue.length) return null
    if (queue.length === 1) return `${roomLabel(latest)} completata`
    return `${queue.length} camere completate`
  }, [queue, latest])

  if (!enabled || !queue.length) return null

  return (
    <aside className="rs-hk-alert" role="status" aria-live="polite" aria-label={`Aggiornamento Housekeeping ${hotel?.name || ''}`} data-testid="housekeeping-completion-alert">
      <div className="rs-hk-alert__body">
        <strong>{summary}</strong>
        {queue.length === 1 ? (
          <small>{latest.housekeeper_name_snapshot || 'Governante'}{latest.completed_at ? ` · ${timeLabel(latest.completed_at)}` : ''}</small>
        ) : (
          <button type="button" onClick={() => setOpenList((value) => !value)}>{openList ? 'Nascondi dettagli' : 'Vedi dettagli'}</button>
        )}
      </div>
      <button type="button" className="rs-hk-alert__close" aria-label="Chiudi avviso camere completate" onClick={() => { setQueue([]); setOpenList(false) }}>×</button>
      {openList && queue.length > 1 && (
        <ul className="rs-hk-alert__list">
          {queue.slice().reverse().map((row, index) => (
            <li key={`${row.id || row.camera}-${index}`}>
              <b>{roomLabel(row)}</b>
              <span>{row.housekeeper_name_snapshot || 'Governante'}{row.completed_at ? ` · ${timeLabel(row.completed_at)}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
