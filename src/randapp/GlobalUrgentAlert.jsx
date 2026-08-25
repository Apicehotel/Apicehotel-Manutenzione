import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchUrgents, subscribeUrgents, updateUrgentRow } from '../urgents-data.js'
import { Button, Icon } from './ui.jsx'
import './global-urgent.css'

const REPEAT_MS = 30000
const MANAGE_ROLES = new Set(['admin', 'manutentore', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'Reception'])

function priorityFive(item) {
  return item && item.status !== 'completata' && ['urgente', 'emergenza', 5, '5'].includes(item.severity)
}

export default function GlobalUrgentAlert({ hotel, user, hidden = false, onOpen }) {
  const [items, setItems] = useState([])
  const [ringKey, setRingKey] = useState(0)
  const audioRef = useRef(null)
  const unlockedRef = useRef(false)

  const load = useCallback(async () => {
    if (!hotel?.id) return
    const result = await fetchUrgents(hotel.id)
    setItems(result.items || [])
  }, [hotel?.id])

  useEffect(() => {
    load()
    if (!hotel?.id) return undefined
    return subscribeUrgents(hotel.id, load)
  }, [hotel?.id, load])

  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (!AudioCtx) return
        audioRef.current = audioRef.current || new AudioCtx()
        if (audioRef.current.state === 'suspended') audioRef.current.resume()
        unlockedRef.current = true
      } catch { /* audio non disponibile */ }
    }
    window.addEventListener('pointerdown', unlock, { passive: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  const active = useMemo(() => items.filter(priorityFive).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [items])
  const openItems = useMemo(() => active.filter((item) => item.status === 'aperta'), [active])
  const current = openItems[0] || active[0] || null

  const ring = useCallback(() => {
    if (!openItems.length || hidden) return
    setRingKey((n) => n + 1)
    try { if (navigator.vibrate) navigator.vibrate([180, 100, 180, 100, 300]) } catch { /* non supportato */ }
    try {
      const ctx = audioRef.current
      if (!ctx || ctx.state !== 'running') return
      const now = ctx.currentTime
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
      gain.connect(ctx.destination)
      ;[760, 960].forEach((freq, index) => {
        const osc = ctx.createOscillator()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(freq, now + index * 0.08)
        osc.connect(gain)
        osc.start(now + index * 0.08)
        osc.stop(now + 0.68)
      })
    } catch { /* richiamo visivo resta attivo */ }
  }, [hidden, openItems.length])

  useEffect(() => {
    if (!openItems.length || hidden) return undefined
    ring()
    const timer = window.setInterval(ring, REPEAT_MS)
    return () => window.clearInterval(timer)
  }, [hidden, openItems.length, ring])

  if (hidden || !current) return null

  const canTake = MANAGE_ROLES.has(user?.role) && current.status === 'aperta'
  const take = async () => {
    await updateUrgentRow(current.id, { hotelId: hotel.id, status: 'presa_in_carico', takenBy: user?.name || 'Utente' })
    await load()
  }

  return (
    <aside className={`rs-global-urgent ${current.status === 'aperta' ? 'is-open' : 'is-taken'}`} data-ring={ringKey} data-testid="global-priority-5" role="alert" aria-live="assertive">
      <button type="button" className="rs-global-urgent__main" onClick={onOpen}>
        <span className="rs-global-urgent__icon"><Icon name="warning" /></span>
        <span className="rs-global-urgent__copy">
          <strong>PRIORITÀ 5 · {current.status === 'aperta' ? 'URGENZA ATTIVA' : 'PRESA IN CARICO'}</strong>
          <span>{current.location ? `${current.location} · ` : ''}{current.note}</span>
          <small>{active.length > 1 ? `${active.length} urgenze attive · Tocca per vedere tutte` : 'Tocca per aprire gli avvisi urgenti'}</small>
        </span>
        <Icon name="chevronRight" />
      </button>
      {canTake && <Button size="sm" variant="primary" onClick={take}>Prendi in carico</Button>}
    </aside>
  )
}
