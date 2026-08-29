import { useEffect, useMemo, useState } from 'react'
import { loadSession } from '../session.js'
import { findInternalProcedure } from './knowledge.js'
import './randai.css'

const EVENT = 'apice-session-changed'

function answerFor(hotelId, query) {
  const procedure = findInternalProcedure({ hotelId, query })
  if (!procedure) {
    return {
      kind: 'missing',
      text: 'Non trovo ancora una procedura interna approvata per questo problema. Posso aiutarti a raccogliere i dati, ma non inventerò una procedura tecnica.',
    }
  }
  return { kind: 'procedure', procedure }
}

export default function RandAIAssistant() {
  const [session, setSession] = useState(loadSession())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState([])

  useEffect(() => {
    const refresh = () => setSession(loadSession())
    window.addEventListener(EVENT, refresh)
    return () => window.removeEventListener(EVENT, refresh)
  }, [])

  useEffect(() => {
    setOpen(false)
    setMessages([])
    setQuery('')
  }, [session?.hotelId, session?.userId])

  const hotelLabel = useMemo(() => ({
    hotelgio: 'Hotel Giò',
    chocohotel: 'Chocohotel',
    brigantino: 'Il Brigantino',
  }[session?.hotelId] || 'struttura attiva'), [session?.hotelId])

  if (!session?.hotelId) return null

  const submit = (event) => {
    event.preventDefault()
    const clean = query.trim()
    if (!clean) return
    const reply = answerFor(session.hotelId, clean)
    setMessages((current) => [...current, { role: 'user', text: clean }, { role: 'assistant', ...reply }])
    setQuery('')
  }

  return (
    <div className={`randai ${open ? 'randai--open' : ''}`} data-testid="randai-root">
      {open && (
        <section className="randai__panel" role="dialog" aria-label="RandAI assistente manutenzione">
          <header className="randai__header">
            <div><strong>RandAI</strong><small>Assistente manutenzione · {hotelLabel}</small></div>
            <button type="button" className="randai__close" onClick={() => setOpen(false)} aria-label="Chiudi RandAI">×</button>
          </header>

          <div className="randai__messages" aria-live="polite">
            {messages.length === 0 && (
              <div className="randai__welcome">
                <b>Come posso aiutarti?</b>
                <p>Descrivi il problema. Ti guiderò prima con le procedure interne approvate della struttura.</p>
                {session.hotelId === 'hotelgio' && (
                  <button type="button" onClick={() => setQuery('Al Jazz i condizionatori non freddano, cosa faccio?')}>
                    Prova: condizionatori Jazz
                  </button>
                )}
              </div>
            )}

            {messages.map((message, index) => message.role === 'user' ? (
              <div className="randai__bubble randai__bubble--user" key={`${index}-${message.text}`}>{message.text}</div>
            ) : message.kind === 'procedure' ? (
              <article className="randai__bubble randai__bubble--assistant" key={`${index}-${message.procedure.id}`}>
                <span className="randai__source">Procedura interna</span>
                <h3>{message.procedure.title}</h3>
                <p>{message.procedure.summary}</p>
                <ol>{message.procedure.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                <small>{message.procedure.sourceLabel}</small>
                <div className="randai__caution">{message.procedure.caution}</div>
              </article>
            ) : (
              <div className="randai__bubble randai__bubble--assistant" key={`${index}-${message.text}`}>
                <span className="randai__source">Nessuna procedura trovata</span>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <form className="randai__composer" onSubmit={submit}>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows="2" placeholder="Es. Al 1° Jazz non freddano i condizionatori…" aria-label="Domanda a RandAI" />
            <button type="submit" disabled={!query.trim()}>Chiedi</button>
          </form>
        </section>
      )}

      <button type="button" className="randai__fab" onClick={() => setOpen((value) => !value)} aria-label="Apri RandAI" data-testid="randai-fab">
        <img src="/icons/randai-cat.webp" alt="" aria-hidden="true" />
      </button>
    </div>
  )
}
