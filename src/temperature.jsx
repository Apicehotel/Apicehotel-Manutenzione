import { useCallback, useEffect, useMemo, useState } from 'react'
import { hotelGioClient as sensorsClient } from './hotelgio-data.js'
import { displaySensorName, groupSwitches, switchStatus, temperatureSensors } from './sensor-display.js'
import './sensor-switches.css'

const formatUpdatedAt = (value) => value
  ? new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  : '—'

function useSensorData(hotel) {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    const flagColumn = `mostra_${hotel.id}`
    const { data, error: requestError } = await sensorsClient.from('sensori_temperatura').select('*').eq(flagColumn, true)
    setSensors(data || [])
    setError(requestError ? 'Impossibile caricare i dati.' : '')
    setLoading(false)
  }, [hotel.id])
  useEffect(() => {
    load()
    const channel = sensorsClient.channel(`apice-sensori-${hotel.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'sensori_temperatura' }, load).subscribe()
    return () => { sensorsClient.removeChannel(channel) }
  }, [load, hotel.id])
  return { sensors, loading, error, load }
}

function SensorCard({ sensor }) {
  const temperature = Number.parseFloat(sensor.temperatura)
  const offline = !sensor.online
  const alert = Boolean(sensor.in_allerta)
  const state = offline || !Number.isFinite(temperature) ? 'muted' : temperature < 0 ? 'cold' : alert ? 'alert' : 'normal'
  return (
    <article className={`temperature-card temperature-card--v2 ${alert ? 'in-alert' : ''} ${offline ? 'is-offline' : ''}`}>
      <div className="temperature-card__copy">
        <strong>{sensor.nome?.trim() || 'Sensore'}</strong>
        <small>Agg. {formatUpdatedAt(sensor.aggiornato_il)}{alert ? ' · soglia superata' : ''}</small>
      </div>
      <div className="temperature-card__reading">
        <b className={state}>{Number.isFinite(temperature) ? `${temperature} °C` : '—'}</b>
        <span className={`temperature-status ${offline ? 'temperature-status--offline' : alert ? 'temperature-status--alert' : 'temperature-status--online'}`}>
          {offline ? 'Offline' : alert ? 'Attenzione' : 'Online'}
        </span>
      </div>
    </article>
  )
}

export function TemperatureSensors({ hotel }) {
  const { sensors, loading, error, load } = useSensorData(hotel)
  const temperatures = useMemo(() => temperatureSensors(sensors), [sensors])
  const ordered = useMemo(() => [...temperatures].sort((a, b) => {
    const severity = (sensor) => !sensor.online ? 3 : sensor.in_allerta ? 2 : 1
    return severity(b) - severity(a) || String(a.nome || '').localeCompare(String(b.nome || ''), 'it')
  }), [temperatures])
  const summary = useMemo(() => ({
    total: temperatures.length,
    online: temperatures.filter((sensor) => sensor.online).length,
    offline: temperatures.filter((sensor) => !sensor.online).length,
    alerts: temperatures.filter((sensor) => sensor.online && sensor.in_allerta).length,
  }), [temperatures])

  return <section className="temperature-page temperature-page--v2" aria-labelledby="temperature-title">
    <header className="temperature-heading"><div><h1 id="temperature-title">Sensori</h1><p>{hotel.name} · temperature e misure</p></div><button className="secondary temperature-refresh" onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : '↻ Ricarica'}</button></header>
    {error && <p className="temperature-error" role="alert">{error}</p>}
    {!loading && temperatures.length > 0 && (
      <div className="temperature-summary" aria-label="Riepilogo sensori">
        <div><span>Totale</span><strong>{summary.total}</strong></div>
        <div><span>Online</span><strong>{summary.online}</strong></div>
        <div className={summary.offline ? 'has-warning' : ''}><span>Offline</span><strong>{summary.offline}</strong></div>
        <div className={summary.alerts ? 'has-warning' : ''}><span>Alert</span><strong>{summary.alerts}</strong></div>
      </div>
    )}
    {loading && !sensors.length ? <div className="temperature-empty">Carico i sensori…</div> : !ordered.length ? <div className="temperature-empty">Nessun sensore disponibile.</div> : <div className="temperature-list temperature-list--v2">{ordered.map((sensor) => <SensorCard key={sensor.device_id} sensor={sensor} />)}</div>}
  </section>
}

export function PlantStatus({ hotel }) {
  const { sensors, loading, error, load } = useSensorData(hotel)
  const sections = useMemo(() => groupSwitches(sensors), [sensors])
  return <section className="temperature-page plant-page" aria-labelledby="plant-title">
    <header className="temperature-heading"><div><h1 id="plant-title">Impianti</h1><p>{hotel.name} · stato reale ON/OFF</p></div><button className="secondary temperature-refresh" onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : '↻ Ricarica'}</button></header>
    {error && <p className="temperature-error" role="alert">{error}</p>}
    {loading && !sensors.length ? <div className="temperature-empty">Carico gli impianti…</div> : !sections.length ? <div className="temperature-empty">Nessun impianto disponibile.</div> : sections.map((section) => <section className="plant-section" key={section.id}><div className="plant-section__head"><h2>{section.label}</h2></div>{section.groups.map((group) => <div className="plant-subgroup" key={group.id}>{group.label && <h3>{group.label}</h3>}<div className="plant-state-list">{group.sensors.map((sensor) => { const status = switchStatus(sensor); return <article className="plant-state-card" key={sensor.device_id}><div><strong>{displaySensorName(sensor)}</strong><small>{sensor.online ? 'Online' : '⚠️ Offline'} · agg. {formatUpdatedAt(sensor.aggiornato_il)}</small></div><span className={`plant-status plant-status--${status.key}`}>{status.label}</span></article> })}</div></div>)}</section>)}
  </section>
}
