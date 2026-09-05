import { useEffect, useMemo, useState } from 'react'
import { fetchPlanningWork, subscribePlanningWork } from '../planning-work-data.js'
import { Stack } from './randui/visual-primitives.jsx'
import NewWorkSheet from './planning/NewWorkSheet.jsx'
import PlanningDateNavigator from './planning/PlanningDateNavigator.jsx'
import WorkRow from './planning/WorkRow.jsx'
import { WEEKDAYS, addDays, iso, mondayOf } from './planning/date-utils.js'

const label = (date) => `${WEEKDAYS[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`
const rangeLabel = (start) => `${start.getDate()}/${start.getMonth() + 1} – ${addDays(start, 6).getDate()}/${addDays(start, 6).getMonth() + 1}`

export default function PlanningWorkSimple({ hotel, user, openRequest = 0 }) {
  const [anchor, setAnchor] = useState(() => mondayOf())
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(false)
  const weekStart = mondayOf(anchor)
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const load = async () => setItems(await fetchPlanningWork(hotel.id))

  useEffect(() => {
    load()
    const off = subscribePlanningWork(hotel.id, load)
    return off
  }, [hotel.id])

  useEffect(() => { if (openRequest) setCreating(true) }, [openRequest])

  return (
    <Stack>
      <PlanningDateNavigator
        label={rangeLabel(weekStart)}
        onPrevious={() => setAnchor(addDays(weekStart, -7))}
        onNext={() => setAnchor(addDays(weekStart, 7))}
      />
      {days.map((day) => {
        const date = iso(day)
        const list = items.filter((item) => item.date === date)
        const today = date === iso(new Date())
        return (
          <section key={date} className="rs-randui-day" data-today={today || undefined}>
            <h3 className="rs-randui-day__title">{label(day)}{today ? ' · oggi' : ''}</h3>
            {list.length
              ? list.map((item) => <WorkRow key={item.id} item={item} user={user} onChanged={load} />)
              : <p className="rs-randui-emptyline">Nessun lavoro.</p>}
          </section>
        )
      })}
      <NewWorkSheet open={creating} onClose={() => setCreating(false)} weekStart={weekStart} hotel={hotel} user={user} onSaved={load} />
    </Stack>
  )
}
