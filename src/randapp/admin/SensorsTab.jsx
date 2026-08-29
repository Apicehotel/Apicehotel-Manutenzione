import { useEffect, useMemo, useState } from 'react'
import { HOTELS } from '../../config.js'
import { fetchAllSensors, refreshSensors, updateSensorVisibility } from '../../sensors-admin-data.js'
import { displaySensorName, groupSwitches, switchStatus, temperatureSensors } from '../../sensor-display.js'
import { Button, Card, EmptyState, Spinner } from '../ui.jsx'

function Visibility({ sensor, onToggle }) {
  return <div className="rs-hotel-toggles">{HOTELS.map((hotel) => <button key={hotel.id} className={`rs-hotel-toggle ${sensor[`mostra_${hotel.id}`] ? 'on' : ''}`} onClick={() => onToggle(sensor, hotel.id)}>{sensor[`mostra_${hotel.id}`] ? '✓ ' : ''}{hotel.short}</button>)}</div>
}

function SwitchCard({ sensor, onToggle }) {
  const status = switchStatus(sensor)
  return <Card className="rs-sensor">
    <div className="rs-sensor__info">
      <strong>{displaySensorName(sensor)}</strong>
      <small>{status.label}{sensor.online ? '' : ' · offline'}</small>
    </div>
    <Visibility sensor={sensor} onToggle={onToggle} />
  </Card>
}

function TemperatureCard({ sensor, onToggle }) {
  return <Card className="rs-sensor">
    <div className="rs-sensor__info">
      <strong>{sensor.nome?.trim() || sensor.device_id}</strong>
      <small>{sensor.temperatura != null ? `${sensor.temperatura}°C` : 'Temperatura non disponibile'}{sensor.online ? '' : ' · offline'}</small>
    </div>
    <Visibility sensor={sensor} onToggle={onToggle} />
  </Card>
}

export default function SensorsTab() {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchAllSensors().then((result) => setSensors(result.sensors || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const switchSections = useMemo(() => groupSwitches(sensors), [sensors])
  const temperatures = useMemo(() => temperatureSensors(sensors), [sensors])

  const toggle = async (sensor, hotelId) => {
    const flags = {
      hotelgio: !!sensor.mostra_hotelgio,
      chocohotel: !!sensor.mostra_chocohotel,
      brigantino: !!sensor.mostra_brigantino,
    }
    flags[hotelId] = !flags[hotelId]
    setSensors((list) => list.map((item) => item.device_id === sensor.device_id ? { ...item, [`mostra_${hotelId}`]: flags[hotelId] } : item))
    await updateSensorVisibility(sensor.device_id, flags)
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const result = await refreshSensors()
      setSensors(result.sensors || [])
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) return <Spinner label="Carico sensori…" />

  return <section data-testid="settings-sensors">
    <div className="rs-page-title">
      <div><h1>Sensori</h1><p>Dispositivi eWeLink ordinati per funzione. Qui vengono mostrati anche gli stati reali ON/OFF.</p></div>
      <Button variant="ghost" icon="refresh" onClick={refresh} disabled={refreshing}>{refreshing ? 'Ricarico…' : 'Ricarica'}</Button>
    </div>

    {sensors.length === 0 ? <EmptyState icon="sensor" title="Nessun sensore">Nessun dato eWeLink ancora disponibile.</EmptyState> : <>
      {switchSections.map((section) => <div key={section.id} style={{ marginBottom: 22 }}>
        <h2 style={{ margin: '0 0 10px' }}>{section.label}</h2>
        {section.groups.map((group) => <div key={group.id} style={{ marginBottom: 14 }}>
          {group.label && <h3 style={{ margin: '0 0 8px', fontSize: '.85rem', opacity: .72 }}>{group.label}</h3>}
          {group.sensors.map((sensor) => <SwitchCard key={sensor.device_id} sensor={sensor} onToggle={toggle} />)}
        </div>)}
      </div>)}

      {!!temperatures.length && <div>
        <h2 style={{ margin: '0 0 10px' }}>Temperature</h2>
        {temperatures.map((sensor) => <TemperatureCard key={sensor.device_id} sensor={sensor} onToggle={toggle} />)}
      </div>}
    </>}
  </section>
}
