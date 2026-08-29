import { useCallback, useEffect, useMemo, useState } from 'react'
import { hotelGioClient as sensorsClient } from './hotelgio-data.js'
import { displaySensorName, groupSwitches, switchStatus, temperatureSensors } from './sensor-display.js'
import './sensor-switches.css'

export function TemperatureSensors({ hotel }) {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const flagColumn = `mostra_${hotel.id}`
    const { data, error: requestError } = await sensorsClient
      .from('sensori_temperatura')
      .select('*')
      .eq(flagColumn, true)
      .order('ordine')
    setSensors(data || [])
    setError(requestError ? 'Impossibile caricare sensori e impianti.' : '')
    setLoading(false)
  }, [hotel.id])

  useEffect(() => {
    load()
    const channel = sensorsClient.channel(`apice-sensori-temp-${hotel.id}`).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sensori_temperatura' },
      load,
    ).subscribe()
    return () => { sensorsClient.removeChannel(channel) }
  }, [load, hotel.id])

  const switchSections = useMemo(() => groupSwitches(sensors), [sensors])
  const temperatures = useMemo(() => temperatureSensors(sensors), [sensors])

  return <section className="temperature-page plant-page" aria-labelledby="temperature-title">
    <header className="temperature-heading">
      <div>
        <h1 id="temperature-title">Impianti e temperature</h1>
        <p>{hotel.name} · stato eWeLink aggiornato automaticamente</p>
      </div>
      <button className="secondary temperature-refresh" onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : '↻ Ricarica'}</button>
    </header>

    {error && <p className="temperature-error" role="alert">{error}</p>}

    {loading && !sensors.length ? <div className="temperature-empty">Carico sensori e impianti…</div> : !sensors.length ? <div className="temperature-empty">Nessun dispositivo ancora sincronizzato.</div> : <>
      {switchSections.map((section) => (
        <section className="plant-section" key={section.id} aria-labelledby={`plant-${section.id}`}>
          <div className="plant-section__head">
            <h2 id={`plant-${section.id}`}>{section.label}</h2>
          </div>
          {section.groups.map((group) => (
            <div className="plant-subgroup" key={group.id}>
              {group.label && <h3>{group.label}</h3>}
              <div className="plant-state-list">
                {group.sensors.map((sensor) => {
                  const status = switchStatus(sensor)
                  return <article className="plant-state-card" key={sensor.device_id}>
                    <div>
                      <strong>{displaySensorName(sensor)}</strong>
                      <small>{sensor.online ? 'Collegato' : 'Dispositivo non raggiungibile'} · agg. {sensor.aggiornato_il ? new Date(sensor.aggiornato_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}</small>
                    </div>
                    <span className={`plant-status plant-status--${status.key}`}>{status.label}</span>
                  </article>
                })}
              </div>
            </div>
          ))}
        </section>
      ))}

      {!!temperatures.length && <>
        {!!switchSections.length && <div className="plant-divider" />}
        <section className="plant-section" aria-labelledby="plant-temperatures">
          <div className="plant-section__head"><h2 id="plant-temperatures">Temperature</h2></div>
          <div className="temperature-list">
            {temperatures.map((sensor) => {
              const temperature = Number.parseFloat(sensor.temperatura)
              const state = !sensor.online || !Number.isFinite(temperature) ? 'muted' : temperature < 0 ? 'cold' : sensor.in_allerta ? 'alert' : 'normal'
              return <article className={`temperature-card ${sensor.in_allerta ? 'in-alert' : ''}`} key={sensor.device_id}>
                <div>
                  <strong>{sensor.in_allerta ? '🌡️ ' : ''}{sensor.nome?.trim()}</strong>
                  <small>{sensor.online ? 'Online' : '⚠️ Offline'} · agg. {sensor.aggiornato_il ? new Date(sensor.aggiornato_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}{sensor.in_allerta ? ' · sopra i 20 °C' : ''}</small>
                </div>
                <b className={state}>{Number.isFinite(temperature) ? `${temperature} °C` : '—'}</b>
              </article>
            })}
          </div>
        </section>
      </>}
    </>}
  </section>
}
