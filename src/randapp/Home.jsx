import { useEffect, useState } from 'react'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { Card, Icon, Spinner } from './ui.jsx'
import { firstName, can, isToday, URGENCY_META } from './helpers.js'

export default function Home({ user, hotel, onNavigate }) {
  const [loading, setLoading] = useState(true)
  const [issues, setIssues] = useState([])
  const [urgents, setUrgents] = useState([])
  const [planned, setPlanned] = useState([])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([fetchIssues(hotel.id), fetchUrgents(hotel.id), fetchPlanned(hotel.id)]).then((res) => {
      if (!active) return
      setIssues(res[0].value?.issues || [])
      setUrgents(res[1].value?.items || [])
      setPlanned(res[2].value?.items || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [hotel.id])

  const openIssues = issues.filter((i) => i.status !== 'done')
  const openUrgents = urgents.filter((u) => u.status !== 'completata')
  const todayInterventions = planned.filter((p) => p.status !== 'done' && (isToday(p.scheduledAt) || (p.scheduledAt && p.scheduledUntil && p.scheduledAt <= Date.now() && p.scheduledUntil >= Date.now())))
  const recent = [...issues].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4)

  const stats = [
    { icon: 'issues', cls: '', count: openIssues.length, title: 'Segnalazioni aperte', sub: openIssues.length ? 'Da gestire' : 'Tutto in ordine', view: 'issues' },
    { icon: 'warning', cls: 'warn', count: openUrgents.length, title: 'Urgenti', sub: openUrgents.length ? 'Richiedono azione' : 'Nessun avviso', view: 'urgent' },
    { icon: 'wrench', cls: 'blue', count: todayInterventions.length, title: 'Interventi oggi', sub: 'Pianificati', view: 'interventions' },
  ]

  return (
    <div data-testid="home-view">
      <section className="rs-hero">
        <h1>Ciao, {firstName(user?.name)}</h1>
        <p>{hotel.name} · ecco la situazione di oggi</p>
      </section>

      {loading ? <Spinner label="Carico i dati della struttura…" /> : (
        <>
          <div className="rs-stats" data-testid="home-stats">
            {stats.map((s) => (
              <Card key={s.title} as="button" className="rs-stat" onClick={() => onNavigate?.(s.view)} data-testid={`stat-${s.view}`}>
                <span className={`rs-stat__icon ${s.cls}`}><Icon name={s.icon} /></span>
                <b className="rs-stat__count">{s.count}</b>
                <h3>{s.title}</h3>
                <p>{s.sub}</p>
              </Card>
            ))}
          </div>

          <section className="rs-section">
            <div className="rs-section__head"><h2>Azioni rapide</h2></div>
            <div className="rs-quick">
              {can(user, 'create') && (
                <button className="rs-quickbtn accent" onClick={() => onNavigate?.('issues')} data-testid="quick-new-issue">
                  <Icon name="plus" /> Nuova segnalazione
                </button>
              )}
              <button className="rs-quickbtn" onClick={() => onNavigate?.('issues')} data-testid="quick-open-issues">
                <Icon name="issues" /> Vedi segnalazioni
              </button>
              <button className="rs-quickbtn" onClick={() => onNavigate?.('urgent')} data-testid="quick-urgent">
                <Icon name="warning" /> Avvisi urgenti
              </button>
              <button className="rs-quickbtn" onClick={() => onNavigate?.('interventions')} data-testid="quick-planning">
                <Icon name="wrench" /> Interventi
              </button>
            </div>
          </section>

          <section className="rs-section">
            <div className="rs-section__head"><h2>Attività recenti</h2>{recent.length > 0 && <button onClick={() => onNavigate?.('issues')}>Tutte</button>}</div>
            {recent.length === 0 ? (
              <Card className="rs-card--pad"><p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Nessuna segnalazione registrata per {hotel.name}.</p></Card>
            ) : (
              <div className="rs-list">
                {recent.map((issue) => (
                  <Card as="button" key={issue.id} className="rs-issue" onClick={() => onNavigate?.('issues')} data-testid={`recent-${issue.id}`}>
                    <span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} />
                    <span className="rs-issue__main">
                      <span className="rs-issue__top"><span className="rs-issue__room">{issue.room}</span></span>
                      <span className="rs-issue__title">{issue.title}</span>
                      <span className="rs-issue__meta"><span><Icon name="clock" /> {issue.date}</span>{issue.category && <span>· {issue.category}</span>}</span>
                    </span>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
