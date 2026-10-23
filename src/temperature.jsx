import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hotelGioClient as sensorsClient } from './hotelgio-data.js'
import { displaySensorName, groupSwitches, switchStatus, temperatureSensors } from './sensor-display.js'
import { partitionTemperatureSensors, readSensorCache, writeSensorCache } from './sensor-cache.js'
import ListFetchNotice from './randapp/ListFetchNotice.jsx'
import { PageTitle, Stack } from './randapp/randui/visual-primitives.jsx'
import { Button } from './randapp/ui.jsx'
import { saveSensorSeason } from './sensor-settings-data.js'
import { evaluateSensorAlert } from '../supabase/functions/_shared/sensor-alert-rules.js'
import './sensor-switches.css'

const formatUpdatedAt = (value) => value
  ? new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  : '—'

const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine

function useSensorData(hotel) {
  const [sensors, setSensors] = useState(() => readSensorCache(hotel.id))
  const [loading, setLoading] = useState(true)
  const [ok, setOk] = useState(true)
  const [offline, setOffline] = useState(false)
  const [settings, setSettings] = useState(null)
  const [settingsError, setSettingsError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const cached = readSensorCache(hotel.id)
    if (cached.length) setSensors(cached)

    if (!onlineNow()) {
      setOk(false)
      setOffline(true)
      setLoading(false)
      return
    }

    const flagColumn = `mostra_${hotel.id}`
    try {
      const [{ data, error: requestError }, { data: settingsData, error: settingsRequestError }] = await Promise.all([
        sensorsClient.from('sensori_temperatura').select('*').eq(flagColumn, true),
        sensorsClient.from('sensori_impostazioni').select('id,stagione,soglia_inverno_min,soglia_estate_max,soglia_frigo_max').eq('id', 1).maybeSingle(),
      ])
      if (requestError) throw requestError
      const rows = data || []
      setSensors(rows)
      setSettings(settingsData || null)
      setSettingsError(settingsRequestError || !settingsData ? 'Regola stagionale non disponibile. Ricarica per riprovare.' : '')
      writeSensorCache(hotel.id, rows)
      setOk(true)
      setOffline(false)
    } catch {
      setOk(false)
      setOffline(!onlineNow())
      if (!cached.length) setSensors([])
    } finally {
      setLoading(false)
    }
  }, [hotel.id])

  useEffect(() => {
    load()
    const channel = sensorsClient
      .channel(`apice-sensori-${hotel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensori_temperatura' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sensori_impostazioni' }, load)
      .subscribe()
    return () => { sensorsClient.removeChannel(channel) }
  }, [load, hotel.id])

  return { sensors, settings, setSettings, settingsError, loading, ok, offline, load }
}

function SensorCard({ sensor }) {
  const temperature = Number.parseFloat(sensor.temperatura)
  const isOffline = !sensor.online
  const alert = Boolean(sensor.in_allerta)
  const statusKey = isOffline ? 'offline' : alert ? 'alert' : 'online'
  const statusLabel = isOffline ? 'Offline' : alert ? 'Attenzione' : 'Online'
  const valueTone = isOffline || !Number.isFinite(temperature)
    ? 'muted'
    : temperature < 0
      ? 'cold'
      : alert
        ? 'alert'
        : 'normal'

  return (
    <article
      className={`temperature-card temperature-card--v2 ${alert ? 'in-alert' : ''} ${isOffline ? 'is-offline' : ''}`}
      data-sensor-state={statusKey}
    >
      <div className="temperature-card__copy">
        <span className={`temperature-status temperature-status--${statusKey}`}>{statusLabel}</span>
        <strong>{sensor.nome?.trim() || 'Sensore'}</strong>
        <small>Aggiornato {formatUpdatedAt(sensor.aggiornato_il)}{sensor.soglia != null ? ` · soglia ${sensor.allerta_tipo === 'sotto' ? '<' : '>'} ${sensor.soglia} °C` : ''}{alert ? ' · soglia superata' : ''}</small>
      </div>
      <div className="temperature-card__reading">
        <b className={valueTone} data-testid="sensor-reading">
          {Number.isFinite(temperature) ? `${temperature} °C` : '—'}
        </b>
      </div>
    </article>
  )
}

function SensorSection({ title, tone, sensors }) {
  if (!sensors.length) return null
  return (
    <section className={`temperature-section temperature-section--${tone}`} aria-label={title}>
      <div className="temperature-section__head">
        <h2>{title}</h2>
        <span>{sensors.length}</span>
      </div>
      <div className="temperature-list temperature-list--v2">
        {sensors.map((sensor) => (
          <SensorCard key={sensor.device_id} sensor={sensor} />
        ))}
      </div>
    </section>
  )
}

export function TemperatureSensors({ hotel, user }) {
  const { sensors, settings, setSettings, settingsError, loading, ok, offline, load } = useSensorData(hotel)
  const [savingSeason, setSavingSeason] = useState(false)
  const [seasonNotice, setSeasonNotice] = useState('')
  const seasonInFlight = useRef(false)
  const canManageSeason = Boolean(user?.can_access_admin || user?.canAdmin || user?.can_admin)
  const updateSeason = async (season) => {
    if (!canManageSeason || seasonInFlight.current || loading || !settings || offline || settings.stagione === season) return
    seasonInFlight.current = true
    setSavingSeason(true)
    setSeasonNotice('')
    try {
      const saved = await saveSensorSeason(sensorsClient, season)
      setSettings(saved)
      setSeasonNotice(`Stagione ${saved.stagione} salvata. Regole applicate alle ultime letture disponibili.`)
    } catch (error) {
      setSeasonNotice(error?.message || 'Stagione non salvata. Riprova.')
    } finally {
      seasonInFlight.current = false
      setSavingSeason(false)
    }
  }
  const temperatures = useMemo(() => temperatureSensors(sensors).map((sensor) => settings
    ? { ...sensor, ...evaluateSensorAlert(sensor.ruolo, sensor.temperatura, sensor.online, settings) }
    : sensor), [sensors, settings])
  const partitioned = useMemo(() => partitionTemperatureSensors(temperatures), [temperatures])
  const summary = useMemo(() => ({
    total: temperatures.length,
    online: temperatures.filter((sensor) => sensor.online).length,
    offline: partitioned.offline.length,
    alerts: partitioned.alerts.length,
  }), [temperatures, partitioned])

  return (
    <Stack gap="sm" className="temperature-page temperature-page--v2 rs-ops-surface" data-testid="temperature-view-inner">
      <PageTitle
        title="Sensori"
        subtitle={`${hotel.name} · temperature e misure`}
      />
      <div className="temperature-toolbar">
        {canManageSeason && <div className="temperature-season" role="group" aria-label="Stagione sensori" aria-busy={savingSeason}>
          {['inverno', 'estate'].map((season) => <Button key={season} type="button" variant="ghost" className="temperature-season__option" aria-pressed={settings?.stagione === season} onClick={() => updateSeason(season)} disabled={savingSeason || loading || !settings || offline}>{season === 'inverno' ? 'Inverno' : 'Estate'}</Button>)}
        </div>}
        <Button type="button" variant="outline" icon="refresh" className="temperature-refresh" onClick={load} disabled={loading || savingSeason} aria-busy={loading} data-testid="temperature-refresh">{loading ? 'Ricarico…' : 'Ricarica'}</Button>
      </div>
      <div className="temperature-season-note" role="status" aria-live="polite">
        {settings && <span>Regola attiva: <strong>{settings.stagione}</strong> · motori {settings.stagione === 'inverno' ? `sotto ${settings.soglia_inverno_min} °C` : `sopra ${settings.soglia_estate_max} °C`} · frigo sopra {settings.soglia_frigo_max} °C</span>}
        {savingSeason ? <span>Salvo la stagione…</span> : seasonNotice && <span>{seasonNotice}</span>}
        {settingsError && <span>{settingsError}</span>}
        <small>Ricarica legge gli ultimi dati sincronizzati; non comanda i dispositivi.</small>
      </div>
      <ListFetchNotice
        ok={ok}
        offline={offline}
        hasItems={temperatures.length > 0}
        onRetry={load}
        loading={loading && !sensors.length}
        resourceLabel="lista sensori"
      />
      {!loading && temperatures.length > 0 && (
        <div className="temperature-summary" aria-label="Riepilogo sensori">
          <div><span>Totale</span><strong>{summary.total}</strong></div>
          <div><span>Online</span><strong>{summary.online}</strong></div>
          <div className={summary.offline ? 'has-warning' : ''}><span>Offline</span><strong>{summary.offline}</strong></div>
          <div className={summary.alerts ? 'has-warning' : ''}><span>Alert</span><strong>{summary.alerts}</strong></div>
        </div>
      )}
      {loading && !sensors.length ? (
        <div className="temperature-empty">Carico i sensori…</div>
      ) : !temperatures.length && ok ? (
        <div className="temperature-empty">Nessun sensore disponibile.</div>
      ) : (
        <>
          <SensorSection title="In allerta" tone="alert" sensors={partitioned.alerts} />
          <SensorSection title="Offline" tone="offline" sensors={partitioned.offline} />
          <SensorSection title="Operativi" tone="ok" sensors={partitioned.ok} />
        </>
      )}
    </Stack>
  )
}

export function PlantStatus({ hotel }) {
  const { sensors, loading, ok, offline, load } = useSensorData(hotel)
  const sections = useMemo(() => groupSwitches(sensors), [sensors])
  return (
    <Stack gap="sm" className="temperature-page plant-page rs-ops-surface" data-testid="plants-view-inner">
      <PageTitle
        title="Impianti"
        subtitle={`${hotel.name} · stato reale ON/OFF`}
        action={(
          <Button variant="outline" size="sm" onClick={load} disabled={loading} data-testid="plants-refresh">
            {loading ? 'Aggiorno…' : 'Ricarica'}
          </Button>
        )}
      />
      <ListFetchNotice
        ok={ok}
        offline={offline}
        hasItems={sections.length > 0}
        onRetry={load}
        loading={loading && !sensors.length}
        resourceLabel="lista impianti"
      />
      {loading && !sensors.length ? (
        <div className="temperature-empty">Carico gli impianti…</div>
      ) : !sections.length && ok ? (
        <div className="temperature-empty">Nessun impianto disponibile.</div>
      ) : sections.map((section) => (
        <section className="plant-section" key={section.id}>
          <div className="plant-section__head"><h2>{section.label}</h2></div>
          {section.groups.map((group) => (
            <div className="plant-subgroup" key={group.id}>
              {group.label && <h3>{group.label}</h3>}
              <div className="plant-state-list">
                {group.sensors.map((sensor) => {
                  const status = switchStatus(sensor)
                  return (
                    <article className="plant-state-card" key={sensor.device_id}>
                      <div>
                        <strong>{displaySensorName(sensor)}</strong>
                        <small>{sensor.online ? 'Online' : 'Offline'} · agg. {formatUpdatedAt(sensor.aggiornato_il)}</small>
                      </div>
                      <span className={`plant-status plant-status--${status.key}`}>{status.label}</span>
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </Stack>
  )
}
