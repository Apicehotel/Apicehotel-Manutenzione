import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import './whatsapp-console.css'

const HOTEL_LABELS = Object.fromEntries(HOTELS.map((hotel) => [hotel.id, hotel.name]))
const formatDate = (value) => value ? new Date(value).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const maskPhone = (value) => {
  const text = String(value || '')
  if (text.length < 7) return text || '—'
  return `${text.slice(0, 5)}••••${text.slice(-3)}`
}

function StateBadge({ status }) {
  const label = {
    paused: 'Ricevuto durante pausa', received: 'Ricevuto', needs_info: 'Dati mancanti',
    created: 'Creato in RandApp', ignored: 'Ignorato', linked: 'Collegato', duplicate: 'Duplicato', error: 'Errore',
  }[status] || status || '—'
  return <span className={`wa-state wa-${status || 'unknown'}`}>{label}</span>
}

export default function WhatsAppConsole({ accessHotels = [], hotelFilter = 'all' }) {
  const [settings, setSettings] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingHotel, setSavingHotel] = useState(null)
  const [error, setError] = useState('')

  const visibleHotels = useMemo(() => hotelFilter === 'all' ? accessHotels : accessHotels.filter((id) => id === hotelFilter), [accessHotels, hotelFilter])

  const load = useCallback(async () => {
    if (!supabase || !accessHotels.length) return
    setLoading(true)
    setError('')
    const [channelResult, messageResult] = await Promise.all([
      supabase.from('whatsapp_channel_settings').select('hotel_id,inbound_number,receive_enabled,ingestion_enabled,updated_at').in('hotel_id', accessHotels).order('hotel_id'),
      supabase.from('whatsapp_inbound_messages').select('id,message_sid,hotel_id,from_number,to_number,body,num_media,media_content_type,media_storage_path,processing_status,issue_id,reply_text,received_at,processed_at').in('hotel_id', accessHotels).order('received_at', { ascending: false }).limit(120),
    ])
    if (channelResult.error || messageResult.error) setError(channelResult.error?.message || messageResult.error?.message || 'Errore WhatsApp')
    else {
      setSettings(channelResult.data || [])
      setMessages(messageResult.data || [])
    }
    setLoading(false)
  }, [accessHotels.join('|')])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!supabase || !accessHotels.length) return undefined
    const channel = supabase.channel('randai-whatsapp-console')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_inbound_messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_channel_settings' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [accessHotels.join('|'), load])

  const toggleIngestion = async (setting) => {
    const next = !setting.ingestion_enabled
    if (next && !window.confirm(`Attivare la creazione automatica da WhatsApp per ${HOTEL_LABELS[setting.hotel_id] || setting.hotel_id}? I nuovi messaggi completi potranno creare Segnalazioni.`)) return
    setSavingHotel(setting.hotel_id)
    setError('')
    const { error: rpcError } = await supabase.rpc('whatsapp_set_ingestion', { p_hotel_id: setting.hotel_id, p_enabled: next })
    if (rpcError) setError(rpcError.message)
    await load()
    setSavingHotel(null)
  }

  const visibleSettings = settings.filter((row) => visibleHotels.includes(row.hotel_id))
  const visibleMessages = messages.filter((row) => visibleHotels.includes(row.hotel_id))
  const pausedCount = visibleMessages.filter((row) => row.processing_status === 'paused').length

  return <div className="wa-console">
    <section className="wa-channels">
      {visibleSettings.map((setting) => <article className="wa-channel-card" key={setting.hotel_id}>
        <div><small>{HOTEL_LABELS[setting.hotel_id] || setting.hotel_id}</small><strong>{setting.inbound_number || 'Nessun numero'}</strong></div>
        <span className={`wa-receive ${setting.receive_enabled ? 'on' : 'off'}`}>{setting.receive_enabled ? 'Ricezione attiva' : 'Ricezione disattiva'}</span>
        <button type="button" className={setting.ingestion_enabled ? 'wa-toggle on' : 'wa-toggle'} onClick={() => toggleIngestion(setting)} disabled={savingHotel === setting.hotel_id || !setting.receive_enabled}>
          <span>{setting.ingestion_enabled ? 'RandApp ATTIVO' : 'RandApp IN PAUSA'}</span><i aria-hidden="true" />
        </button>
        <p>{setting.ingestion_enabled ? 'I nuovi messaggi completi possono creare Segnalazioni.' : 'I messaggi vengono ricevuti e conservati, ma non inviati a RandApp.'}</p>
      </article>)}
    </section>

    <section className="wa-inbox-panel">
      <header><div><small>INBOX TWILIO</small><h2>Messaggi WhatsApp</h2></div><div className="wa-inbox-meta"><span>{visibleMessages.length} ricevuti</span>{pausedCount > 0 && <strong>{pausedCount} in pausa</strong>}<button onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : 'Aggiorna'}</button></div></header>
      {error && <div className="wa-error">{error}</div>}
      {!loading && !visibleMessages.length && <div className="wa-empty">Nessun messaggio ricevuto dalla nuova pipeline.</div>}
      <div className="wa-message-list">
        {visibleMessages.map((message) => <article className="wa-message" key={message.id}>
          <div className="wa-message-head"><div><strong>{HOTEL_LABELS[message.hotel_id] || message.hotel_id}</strong><span>{maskPhone(message.from_number)} · {formatDate(message.received_at)}</span></div><StateBadge status={message.processing_status} /></div>
          <p>{message.body || (message.num_media > 0 ? '[Foto senza testo]' : '[Messaggio senza testo]')}</p>
          <div className="wa-message-foot">
            {message.num_media > 0 && <span>📷 {message.media_storage_path ? 'foto preservata' : 'media ricevuto'}</span>}
            {message.processing_status === 'paused' && <span className="wa-paused-note">Non inviato a RandApp</span>}
            {message.issue_id && <span>Segnalazione {String(message.issue_id).slice(0, 8)}</span>}
            {message.reply_text && <span>Risposta: {message.reply_text}</span>}
          </div>
        </article>)}
      </div>
    </section>
  </div>
}
