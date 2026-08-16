import { useCallback, useEffect, useState } from 'react'
import { hotelGioClient as sensorsClient } from './hotelgio-data.js'
import { supabaseUrl } from './supabase.js'
// La sync dei sensori chiama la edge function del DB unico (Apice MultiHotel),
// non più quella di Hotel Giò. I sensori sono filtrati per hotel_id.
const syncUrl = `${supabaseUrl}/functions/v1/sync-sensori-temperatura`

export function TemperatureSensors({ hotel }) {
  const [sensors, setSensors] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    // Mostra i sensori dove il flag di visibilità di questo hotel è attivo.
    const flagColumn = `mostra_${hotel.id}`
    const { data, error: requestError } = await sensorsClient.from('sensori_temperatura').select('*').eq(flagColumn, true).order('ordine')
    setSensors(data || [])
    setError(requestError ? 'Impossibile caricare le temperature.' : '')
    setLoading(false)
  }, [hotel.id])

  useEffect(() => {
    load()
    const channel = sensorsClient.channel('apice-sensori-temp-'+hotel.id).on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sensori_temperatura' },
      load,
    ).subscribe()
    return () => { sensorsClient.removeChannel(channel) }
  }, [load, hotel.id])

  const refresh = async () => {
    setSyncing(true)
    try { await fetch(syncUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { setError('Sincronizzazione non disponibile.') }
    await load()
    setSyncing(false)
  }

  return <section className="temperature-page" aria-labelledby="temperature-title">
    <header className="temperature-heading">
      <div><h1 id="temperature-title">Sensori temperatura</h1><p>{hotel.name} · aggiornamento automatico ogni 15 minuti</p></div>
      <button className="secondary temperature-refresh" onClick={refresh} disabled={syncing}>{syncing ? 'Aggiorno…' : '↻ Aggiorna'}</button>
    </header>
    {error && <p className="temperature-error" role="alert">{error}</p>}
    {loading ? <div className="temperature-empty">Carico le temperature…</div> : !sensors.length ? <div className="temperature-empty">Nessun sensore ancora sincronizzato.</div> : <div className="temperature-list">
      {sensors.map((sensor) => {
        const temperature = sensor.temperatura == null ? null : Number.parseFloat(sensor.temperatura)
        const state = !sensor.online || temperature == null ? 'muted' : temperature < 0 ? 'cold' : sensor.in_allerta ? 'alert' : 'normal'
        return <article className={`temperature-card ${sensor.in_allerta ? 'in-alert' : ''}`} key={sensor.device_id}>
          <div><strong>{sensor.in_allerta ? '🌡️ ' : ''}{sensor.nome?.trim()}</strong><small>{sensor.online ? 'Online' : '⚠️ Offline'} · agg. {sensor.aggiornato_il ? new Date(sensor.aggiornato_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—'}{sensor.in_allerta ? ' · sopra i 20 °C' : ''}</small></div>
          <b className={state}>{temperature == null ? '—' : `${temperature} °C`}</b>
        </article>
      })}
    </div>}
  </section>
}
