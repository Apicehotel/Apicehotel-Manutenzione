import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Spinner } from '../ui.jsx'
import { loadSession } from '../../session.js'
import { friendlyNtfyError, invokeNtfyAdmin } from '../ntfy/ntfy-client.js'

function fmtWhen(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('it-IT')
}

export default function NtfyTab() {
  const session = useMemo(() => loadSession(), [])
  const hotelId = session?.hotelId || null
  const [busy, setBusy] = useState(true)
  const [action, setAction] = useState('')
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async () => {
    if (!hotelId) {
      setBusy(false)
      setError('Seleziona una struttura per gestire ntfy.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const next = await invokeNtfyAdmin(hotelId, 'status')
      setStatus(next)
    } catch (err) {
      setStatus(null)
      setError(friendlyNtfyError(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { refresh() }, [hotelId])

  const run = async (nextAction, extra = {}, successMessage) => {
    if (!hotelId) return
    setAction(nextAction)
    setError('')
    setMessage('')
    try {
      const result = await invokeNtfyAdmin(hotelId, nextAction, extra)
      setMessage(successMessage(result))
      await refresh()
    } catch (err) {
      setError(friendlyNtfyError(err))
    } finally {
      setAction('')
    }
  }

  const current = status?.current
  const enabled = Boolean(status?.enabled)

  return (
    <div data-testid="ntfy-admin-tab" style={{ display: 'grid', gap: 16 }}>
      <Card className="rs-card--pad">
        <div className="rs-section__head">
          <h2>ntfy · gestione struttura</h2>
          {status && <Badge tone={enabled ? 'done' : 'waiting'}>{enabled ? 'Attivo' : 'Disattivo'}</Badge>}
        </div>
        <p className="rs-ntfy-intro">
          Qui attivi ntfy, completi i topic mancanti e verifichi l’invio.
          Gli operatori restano su Profilo con i soli short link personali: i topic tecnici non escono da questo pannello.
        </p>
        {!hotelId && <p className="rs-error">Struttura non selezionata.</p>}
        {busy && !status && <Spinner label="Carico stato ntfy…" />}
        {status && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="rs-diag-row">
              <div>
                <strong>{current?.label || hotelId}</strong>
                <small>
                  Server {status.server_host} · urgenti {current?.urgent_configured ? 'ok' : 'mancanti'} ·
                  promemoria ruolo {current?.role_topics_configured || 0}/{current?.role_topics_expected || 0} ·
                  housekeeping {status.housekeeping?.configured ? (status.housekeeping.enabled ? 'ok' : 'presente ma off') : 'mancante'}
                </small>
              </div>
              <Badge tone={current?.urgent_configured && current?.role_topics_configured === current?.role_topics_expected ? 'done' : 'waiting'}>
                {current?.urgent_configured ? 'Topic hotel' : 'Da completare'}
              </Badge>
            </div>

            <div className="rs-op-card__actions">
              <Button
                type="button"
                disabled={Boolean(action)}
                onClick={() => run('set_enabled', { enabled: !enabled }, () => enabled ? 'ntfy disattivato.' : 'ntfy attivato.')}
              >
                {action === 'set_enabled' ? 'Salvo…' : enabled ? 'Disattiva ntfy' : 'Attiva ntfy'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(action)}
                onClick={() => run(
                  'ensure_topics',
                  {},
                  (result) => `Topic controllati ✓ (+${result.created_urgent || 0} urgenti, +${result.created_role_topics || 0} ruoli).`,
                )}
              >
                {action === 'ensure_topics' ? 'Completo…' : 'Completa topic mancanti'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(action) || !enabled || !current?.urgent_configured}
                onClick={() => run('test_urgent', {}, () => 'Test urgente inviato ✓ Controlla ntfy sul canale hotel.')}
              >
                {action === 'test_urgent' ? 'Invio…' : 'Test avvisi urgenti'}
              </Button>
              <Button type="button" variant="ghost" disabled={Boolean(action) || busy} onClick={refresh}>Aggiorna</Button>
            </div>
          </div>
        )}
        {message && <p className="rs-success" role="status">{message}</p>}
        {error && <p className="rs-error" role="alert">{error}</p>}
      </Card>

      {status?.hotels?.length > 0 && (
        <Card className="rs-card--pad">
          <div className="rs-section__head"><h3>Stato multi-hotel</h3></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {status.hotels.map((hotel) => (
              <div key={hotel.hotel_id} className="rs-diag-row">
                <div>
                  <strong>{hotel.label}</strong>
                  <small>
                    Urgenti {hotel.urgent_configured ? 'configurati' : 'mancanti'} ·
                    ruoli {hotel.role_topics_configured}/{hotel.role_topics_expected}
                  </small>
                </div>
                <Badge tone={hotel.urgent_configured && hotel.role_topics_configured === hotel.role_topics_expected ? 'done' : 'waiting'}>
                  {hotel.hotel_id === hotelId ? 'Corrente' : hotel.urgent_configured ? 'Ok' : 'Gap'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="rs-card--pad">
        <div className="rs-section__head"><h3>Ultimi invii ntfy</h3></div>
        {!status?.recent?.length ? (
          <p className="rs-muted">Nessun invio recente registrato per questa struttura.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {status.recent.map((row) => (
              <div key={row.id} className="rs-diag-row">
                <div>
                  <strong>{row.subject || 'Notifica ntfy'}</strong>
                  <small>
                    {fmtWhen(row.sent_at || row.created_at)} · {row.metadata?.event_type || 'evento'} · {row.status}
                  </small>
                </div>
                <Badge tone={row.status === 'sent' ? 'done' : 'waiting'}>{row.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
