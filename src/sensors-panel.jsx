import { useEffect, useState } from 'react'
import { fetchAllSensors, refreshSensors, updateSensorVisibility } from './sensors-admin-data.js'
import { HOTELS } from './config.js'

// Pannello admin: lista di tutti i dispositivi eWeLink con 3 checkbox per riga
// (una per hotel) che decidono su quali app il dispositivo è visibile.
export function SensorsPanel() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingId, setSavingId] = useState(null)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    const { sensors: rows } = await fetchAllSensors()
    setSensors(rows)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const refresh = async () => {
    setRefreshing(true)
    setMessage('Ricarico i dati sincronizzati…')
    const { sensors: rows } = await refreshSensors()
    setSensors(rows)
    setMessage(rows.length ? `${rows.length} dispositivi disponibili` : 'Nessun dispositivo trovato')
    setRefreshing(false)
  }

  const toggle = async (sensor, hotelId) => {
    const flags = {
      hotelgio: sensor.mostra_hotelgio,
      chocohotel: sensor.mostra_chocohotel,
      brigantino: sensor.mostra_brigantino,
    }
    flags[hotelId] = !flags[hotelId]
    setSensors((list) => list.map((s) => s.device_id === sensor.device_id ? { ...s, mostra_hotelgio: flags.hotelgio, mostra_chocohotel: flags.chocohotel, mostra_brigantino: flags.brigantino } : s))
    setSavingId(sensor.device_id)
    await updateSensorVisibility(sensor.device_id, flags)
    setSavingId(null)
  }

  return (
    <section className="sensors-panel">
      <header className="sensors-panel-head">
        <div>
          <h2>Visibilità sensori e impianti</h2>
          <p>Scegli su quali strutture mostrare ogni dispositivo. La sincronizzazione eWeLink avviene automaticamente sul server.</p>
        </div>
        <button className="secondary" onClick={refresh} disabled={refreshing}>{refreshing ? 'Ricarico…' : '↻ Ricarica dati'}</button>
      </header>
      {message && <p className="sensors-panel-msg">{message}</p>}
      {loading ? <p className="sensors-panel-msg">Carico i dispositivi…</p> : sensors.length === 0 ? (
        <div className="sensors-empty">
          <strong>Nessun dispositivo ancora sincronizzato</strong>
          <span>La sincronizzazione eWeLink viene eseguita automaticamente dal server.</span>
        </div>
      ) : (
        <div className="sensors-table" role="table">
          <div className="sensors-row sensors-row-head" role="row">
            <span role="columnheader">Dispositivo</span>
            {HOTELS.map((h) => <span key={h.id} role="columnheader" className="sensors-hotel-col">{h.short}</span>)}
          </div>
          {sensors.map((sensor) => (
            <div className="sensors-row" role="row" key={sensor.device_id}>
              <span role="cell" className="sensors-name">
                <strong>{sensor.nome || sensor.device_id}</strong>
                <small>{sensor.temperatura != null ? `${sensor.temperatura}°C` : sensor.switch_state === 'on' ? 'ATTIVO' : sensor.switch_state === 'off' ? 'SPENTO' : '—'}{sensor.online ? '' : ' · offline'}{savingId === sensor.device_id ? ' · salvo…' : ''}</small>
              </span>
              {HOTELS.map((h) => {
                const key = `mostra_${h.id}`
                return (
                  <span role="cell" className="sensors-hotel-col" key={h.id}>
                    <label className="sensors-check">
                      <input type="checkbox" checked={!!sensor[key]} onChange={() => toggle(sensor, h.id)} aria-label={`Mostra ${sensor.nome || sensor.device_id} su ${h.name}`} />
                      <span />
                    </label>
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
