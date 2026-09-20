import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../../planning-work-data.js'
import { fetchBookings, subscribeBookings } from '../../sale-data.js'
import { canUser } from '../../permissions.js'
import { PlanningChoice, isoDay } from './PlanningOverview.jsx'

function statsFor(items, predicate) {
  const visible = items.filter(predicate)
  return {
    today: visible.filter((item) => item.status !== 'done').length,
    finish: visible.filter((item) => item.status === 'da_finire').length,
    done: visible.filter((item) => item.status === 'done').length,
  }
}

export default function PlanningCountCards({ hotel, user, onOpen, className = '' }) {
  const canSeeWork = canUser(user, 'planning_work', 'view')
  const canSeeSale = canUser(user, 'planning_sale', 'view')
  const [work, setWork] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [workItems, saleResult] = await Promise.all([
        canSeeWork ? fetchPlanningWork(hotel.id) : Promise.resolve([]),
        canSeeSale ? fetchBookings(hotel.id) : Promise.resolve({ items: [] }),
      ])
      setWork(workItems || [])
      setBookings(saleResult?.items || [])
    } finally { setLoading(false) }
  }, [hotel.id, canSeeSale, canSeeWork])
  useEffect(() => {
    load().catch(() => setLoading(false))
    const offWork = canSeeWork ? subscribePlanningWork(hotel.id, load) : null
    const offSale = canSeeSale ? subscribeBookings(hotel.id, load) : null
    return () => { offWork?.(); offSale?.() }
  }, [hotel.id, canSeeSale, canSeeWork, load])
  const today = isoDay()
  const workStats = useMemo(() => statsFor(work, (item) => item.date === today), [work, today])
  const saleStats = useMemo(() => statsFor(bookings, (item) => (item.prepDate || item.dateFrom || item.date) === today), [bookings, today])
  if ((!canSeeWork && !canSeeSale) || loading) return null
  return <section className={`rs-planning-counts ${className}`.trim()} aria-label="Conteggi planning di oggi" data-testid="planning-count-cards"><div className="rs-planning-counts__head"><span>Oggi</span><strong>Planning operativo</strong></div><div className="rs-planning-counts__grid">{canSeeWork && <PlanningChoice icon="wrench" title="Planning lavori" stats={workStats} onClick={() => onOpen?.('planning-work')} />}{canSeeSale && <PlanningChoice icon="calendar" title="Planning sale" stats={saleStats} onClick={() => onOpen?.('planning-sale')} />}</div></section>
}
