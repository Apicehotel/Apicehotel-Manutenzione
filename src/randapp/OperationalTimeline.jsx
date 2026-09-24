import { formatOperationalEventTime } from './operational-timeline.js'
import './operational-timeline.css'

export default function OperationalTimeline({ events = [], title = 'Percorso operativo' }) {
  const visible = events.filter(Boolean)
  if (!visible.length) return null
  return (
    <section className="rs-operational-timeline" aria-label={title} data-testid="operational-timeline">
      <div className="rs-operational-timeline__title"><h2>{title}</h2><small>{visible.length} {visible.length === 1 ? 'passaggio' : 'passaggi'}</small></div>
      <ol>{visible.map((item) => (
        <li key={item.id} className={`rs-operational-timeline__item ${item.current ? 'is-current' : ''}`} data-tone={item.tone || 'default'}>
          <span className="rs-operational-timeline__rail" aria-hidden="true"><i /></span>
          <div className="rs-operational-timeline__event">
            <div className="rs-operational-timeline__event-head"><strong>{item.title}</strong>{item.current && <span>Adesso</span>}</div>
            {(item.actor || item.at) && <small className="rs-operational-timeline__meta">{[item.actor, formatOperationalEventTime(item.at)].filter(Boolean).join(' · ')}</small>}
            {item.detail && <p>{item.detail}</p>}
            {item.media && <img src={item.media} alt="" loading="lazy" />}
          </div>
        </li>
      ))}</ol>
    </section>
  )
}
