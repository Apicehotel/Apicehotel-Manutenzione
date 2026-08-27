import { useEffect, useState } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from './supabase.js'

// Pagina pubblica e in sola lettura: /s/<id>. Nessun login, pensata per il link
// mandato al tecnico esterno via WhatsApp. Vedi supabase/functions/public-issue.

const URGENCY_LABEL = { alta: 'Alta', media: 'Media', bassa: 'Bassa' }
const STATUS_LABEL = { todo: 'Da fare', waiting: 'Attesa pezzo', tecnico: 'Tecnico', done: 'Completata' }

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function PublicIssueView({ id }) {
  const [issue, setIssue] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!isSupabaseConfigured) { setError('Servizio non disponibile'); setLoading(false); return }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const url = `${supabaseUrl}/functions/v1/public-issue?id=${encodeURIComponent(id)}`
        const res = await fetch(url, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
          },
        })
        const json = await res.json()
        if (cancelled) return
        if (!json.ok) { setError(json.error || 'Segnalazione non trovata'); return }
        setIssue(json.issue)
      } catch {
        if (!cancelled) setError('Impossibile caricare la segnalazione')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  return (
    <div className="public-issue-page">
      <div className="public-issue-card">
        {loading && <p>Carico…</p>}
        {!loading && error && <p className="public-issue-error">{error}</p>}
        {!loading && issue && (
          <>
            {issue.hotelName && <p className="public-issue-hotel">{issue.hotelName}</p>}
            <h1>{issue.room}</h1>
            <div className="public-issue-meta">
              {issue.category && <span>{issue.category}</span>}
              {issue.urgency && <span className={`urgency badge-${issue.urgency}`}>{URGENCY_LABEL[issue.urgency] || issue.urgency}</span>}
              {issue.status && <span>{STATUS_LABEL[issue.status] || issue.status}</span>}
            </div>
            {issue.title && <p className="public-issue-title">{issue.title}</p>}
            {issue.photoUrl && <img className="public-issue-photo" src={issue.photoUrl} alt="Foto segnalazione" />}
            {issue.createdAt && <p className="public-issue-date">Segnalata il {formatDate(issue.createdAt)}</p>}
          </>
        )}
      </div>
    </div>
  )
}
