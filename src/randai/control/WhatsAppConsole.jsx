import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import './whatsapp-console.css'

const HOTEL_LABELS = Object.fromEntries(HOTELS.map((hotel) => [hotel.id, hotel.name]))
const CATEGORIES = ['Varie', 'Elettrico', 'Idraulico', 'Climatizzazione', 'Arredo', 'Edilizio']
const URGENCIES = ['bassa', 'media', 'alta', 'urgente']
const REVIEWABLE = new Set(['paused', 'received', 'needs_info', 'error'])
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
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingHotel, setSavingHotel] = useState(null)
  const [busyMessage, setBusyMessage] = useState(null)
  const [review, setReview] = useState(null)
  const [error, setError] = useState('')

  const visibleHotels = useMemo(() => hotelFilter === 'all' ? accessHotels : accessHotels.filter((id) => id === hotelFilter), [accessHotels, hotelFilter])

  const load = useCallback(async () => {
    if (!supabase || !accessHotels.length) return
    setLoading(true)
    setError('')
    const [channelResult, messageResult, issueResult] = await Promise.all([
      supabase.from('whatsapp_channel_settings').select('hotel_id,inbound_number,receive_enabled,ingestion_enabled,updated_at').in('hotel_id', accessHotels).order('hotel_id'),
      supabase.from('whatsapp_inbound_messages').select('id,message_sid,hotel_id,from_number,to_number,body,num_media,media_content_type,media_storage_path,processing_status,issue_id,reply_text,received_at,processed_at').in('hotel_id', accessHotels).order('received_at', { ascending: false }).limit(120),
      supabase.from('segnalazioni').select('id,hotel_id,camera,categoria,note,stato,creato_il').in('hotel_id', accessHotels).is('deleted_at', null).order('creato_il', { ascending: false }).limit(120),
    ])
    if (channelResult.error || messageResult.error || issueResult.error) setError(channelResult.error?.message || messageResult.error?.message || issueResult.error?.message || 'Errore WhatsApp')
    else {
      setSettings(channelResult.data || [])
      setMessages(messageResult.data || [])
      setIssues(issueResult.data || [])
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
    if (next && !window.confirm(`Attivare la creazione automatica da WhatsApp per ${HOTEL_LABELS[setting.hotel_id] || setting.hotel_id}? Solo i NUOVI messaggi completi potranno creare Segnalazioni; quelli ricevuti durante la pausa restano in revisione.`)) return
    setSavingHotel(setting.hotel_id)
    setError('')
    const { error: rpcError } = await supabase.rpc('whatsapp_set_ingestion', { p_hotel_id: setting.hotel_id, p_enabled: next })
    if (rpcError) setError(rpcError.message)
    await load()
    setSavingHotel(null)
  }

  const beginCreate = (message) => setReview({ mode: 'create', messageId: message.id, hotelId: message.hotel_id, location: '', problem: message.body || '', category: 'Varie', urgency: 'media', issueId: '' })
  const beginLink = (message) => setReview({ mode: 'link', messageId: message.id, hotelId: message.hotel_id, location: '', problem: '', category: 'Varie', urgency: 'media', issueId: '' })
  const cancelReview = () => setReview(null)

  const createIssue = async () => {
    if (!review?.messageId || !review.location.trim() || !review.problem.trim()) { setError('Per creare la Segnalazione servono camera/zona e descrizione del problema.'); return }
    setBusyMessage(review.messageId); setError('')
    const { error: rpcError } = await supabase.rpc('whatsapp_create_issue_from_inbound', {
      p_message_id: review.messageId,
      p_location: review.location.trim(),
      p_problem: review.problem.trim(),
      p_category: review.category,
      p_urgency: review.urgency,
    })
    if (rpcError) setError(rpcError.message)
    else setReview(null)
    await load(); setBusyMessage(null)
  }

  const linkIssue = async () => {
    if (!review?.messageId || !review.issueId) { setError('Seleziona una Segnalazione esistente da collegare.'); return }
    setBusyMessage(review.messageId); setError('')
    const { error: rpcError } = await supabase.rpc('whatsapp_link_inbound', { p_message_id: review.messageId, p_issue_id: review.issueId })
    if (rpcError) setError(rpcError.message)
    else setReview(null)
    await load(); setBusyMessage(null)
  }

  const ignoreMessage = async (message) => {
    if (!window.confirm('Ignorare questo messaggio? Resterà nello storico come Ignorato e non creerà una Segnalazione.')) return
    setBusyMessage(message.id); setError('')
    const { error: rpcError } = await supabase.rpc('whatsapp_ignore_inbound', { p_message_id: message.id })
    if (rpcError) setError(rpcError.message)
    if (review?.messageId === message.id) setReview(null)
    await load(); setBusyMessage(null)
  }

  const visibleSettings = settings.filter((row) => visibleHotels.includes(row.hotel_id))
  const visibleMessages = messages.filter((row) => visibleHotels.includes(row.hotel_id))
  const pausedCount = visibleMessages.filter((row) => row.processing_status === 'paused').length
  const linkCandidates = review ? issues.filter((issue) => issue.hotel_id === review.hotelId) : []

  return <div className="wa-console">
    <section className="wa-channels">
      {visibleSettings.map((setting) => <article className="wa-channel-card" key={setting.hotel_id}>
        <div><small>{HOTEL_LABELS[setting.hotel_id] || setting.hotel_id}</small><strong>{setting.inbound_number || 'Nessun numero'}</strong></div>
        <span className={`wa-receive ${setting.receive_enabled ? 'on' : 'off'}`}>{setting.receive_enabled ? 'Ricezione attiva' : 'Ricezione disattiva'}</span>
        <button type="button" className={setting.ingestion_enabled ? 'wa-toggle on' : 'wa-toggle'} onClick={() => toggleIngestion(setting)} disabled={savingHotel === setting.hotel_id || !setting.receive_enabled}>
          <span>{setting.ingestion_enabled ? 'RandApp ATTIVO' : 'RandApp IN PAUSA'}</span><i aria-hidden="true" />
        </button>
        <p>{setting.ingestion_enabled ? 'I nuovi messaggi completi possono creare Segnalazioni.' : 'Twilio continua a ricevere e conservare i messaggi, ma RandApp non crea Segnalazioni automaticamente.'}</p>
      </article>)}
    </section>

    <section className="wa-inbox-panel">
      <header><div><small>INBOX TWILIO</small><h2>Messaggi WhatsApp</h2></div><div className="wa-inbox-meta"><span>{visibleMessages.length} ricevuti</span>{pausedCount > 0 && <strong>{pausedCount} in pausa</strong>}<button onClick={load} disabled={loading}>{loading ? 'Aggiorno…' : 'Aggiorna'}</button></div></header>
      {error && <div className="wa-error">{error}</div>}
      {!loading && !visibleMessages.length && <div className="wa-empty">Nessun messaggio ricevuto dalla nuova pipeline.</div>}
      <div className="wa-message-list">
        {visibleMessages.map((message) => {
          const reviewing = review?.messageId === message.id
          const actionable = REVIEWABLE.has(message.processing_status)
          return <article className="wa-message" key={message.id}>
            <div className="wa-message-head"><div><strong>{HOTEL_LABELS[message.hotel_id] || message.hotel_id}</strong><span>{maskPhone(message.from_number)} · {formatDate(message.received_at)}</span></div><StateBadge status={message.processing_status} /></div>
            <p>{message.body || (message.num_media > 0 ? '[Foto senza testo]' : '[Messaggio senza testo]')}</p>
            <div className="wa-message-foot">
              {message.num_media > 0 && <span>📷 {message.media_storage_path ? 'foto preservata' : 'media ricevuto'}</span>}
              {message.processing_status === 'paused' && <span className="wa-paused-note">Non inviato a RandApp</span>}
              {message.issue_id && <span>Segnalazione {String(message.issue_id).slice(0, 8)}</span>}
              {message.reply_text && <span>Risposta: {message.reply_text}</span>}
            </div>
            {actionable && <div className="wa-actions">
              <button type="button" onClick={() => beginCreate(message)} disabled={busyMessage === message.id}>Crea segnalazione</button>
              <button type="button" onClick={() => beginLink(message)} disabled={busyMessage === message.id}>Collega a segnalazione esistente</button>
              <button type="button" className="secondary" onClick={() => ignoreMessage(message)} disabled={busyMessage === message.id}>Ignora</button>
            </div>}
            {reviewing && review.mode === 'create' && <div className="wa-review-box">
              <strong>Crea da questo messaggio</strong>
              <p>Conferma tu camera/zona e problema: RandAI non li completa per supposizione.</p>
              <div className="wa-review-grid">
                <label>Camera / zona<input value={review.location} onChange={(e) => setReview({ ...review, location: e.target.value })} placeholder="es. 201 o Hall Chocohotel" /></label>
                <label>Categoria<select value={review.category} onChange={(e) => setReview({ ...review, category: e.target.value })}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
                <label>Urgenza<select value={review.urgency} onChange={(e) => setReview({ ...review, urgency: e.target.value })}>{URGENCIES.map((value) => <option key={value}>{value}</option>)}</select></label>
                <label className="wide">Problema<textarea value={review.problem} onChange={(e) => setReview({ ...review, problem: e.target.value })} rows="3" /></label>
              </div>
              <div className="wa-review-buttons"><button type="button" onClick={createIssue} disabled={busyMessage === message.id}>Crea in RandApp</button><button type="button" className="secondary" onClick={cancelReview}>Annulla</button></div>
            </div>}
            {reviewing && review.mode === 'link' && <div className="wa-review-box">
              <strong>Collega senza creare duplicati</strong>
              <label>Segnalazione esistente<select value={review.issueId} onChange={(e) => setReview({ ...review, issueId: e.target.value })}><option value="">Seleziona…</option>{linkCandidates.map((issue) => <option key={issue.id} value={issue.id}>{issue.camera || '—'} · {issue.categoria || 'Varie'} · {(issue.note || '').slice(0, 70)}</option>)}</select></label>
              <div className="wa-review-buttons"><button type="button" onClick={linkIssue} disabled={busyMessage === message.id || !review.issueId}>Collega</button><button type="button" className="secondary" onClick={cancelReview}>Annulla</button></div>
            </div>}
          </article>
        })}
      </div>
    </section>
  </div>
}
