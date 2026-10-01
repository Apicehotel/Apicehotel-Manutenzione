import { Icon } from '../ui.jsx'

const cx = (...parts) => parts.filter(Boolean).join(' ')

export function LayeredCard({ as: Tag = 'section', tone = 'default', interactive = false, className = '', children, ...props }) {
  return <Tag className={cx('rs-randui-layered', interactive && 'is-interactive', className)} data-randui-tone={tone} {...props}>{children}</Tag>
}

export function StatCard({ label, value, detail, icon, tone = 'default', trend, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className={cx('rs-randui-statcard', onClick && 'is-interactive', className)} data-randui-tone={tone} onClick={onClick}>
      <span className="rs-randui-statcard__top">
        {icon ? <span className="rs-randui-statcard__icon"><Icon name={icon} /></span> : null}
        <span className="rs-randui-statcard__label">{label}</span>
        {trend ? <span className="rs-randui-statcard__trend">{trend}</span> : null}
      </span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </Tag>
  )
}

export function StatusChip({ children, tone = 'neutral', icon, className = '', ...props }) {
  return <span className={cx('rs-randui-statuschip', className)} data-randui-tone={tone} {...props}>{icon ? <Icon name={icon} /> : null}<span>{children}</span></span>
}

export function ProgressMeter({ value = 0, max = 100, label, detail, tone = 'accent', className = '' }) {
  const safeMax = Math.max(1, Number(max) || 100)
  const safeValue = Math.max(0, Math.min(safeMax, Number(value) || 0))
  const percent = Math.round((safeValue / safeMax) * 100)
  return (
    <div className={cx('rs-randui-progress', className)} data-randui-tone={tone}>
      {(label || detail) && <div className="rs-randui-progress__head"><strong>{label}</strong><small>{detail || `${percent}%`}</small></div>}
      <div className="rs-randui-progress__track" role="progressbar" aria-valuemin="0" aria-valuemax={safeMax} aria-valuenow={safeValue} aria-label={label || 'Avanzamento'}>
        <span style={{ '--rs-progress': `${percent}%` }} />
      </div>
    </div>
  )
}

export function ActivityTimeline({ items = [], className = '' }) {
  return (
    <ol className={cx('rs-randui-activity', className)}>
      {items.map((item, index) => (
        <li key={item.id || index} data-randui-tone={item.tone || 'neutral'}>
          <span className="rs-randui-activity__marker">{item.icon ? <Icon name={item.icon} /> : null}</span>
          <div>
            <div className="rs-randui-activity__head"><strong>{item.title}</strong>{item.time ? <time>{item.time}</time> : null}</div>
            {item.detail ? <p>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function DataList({ items = [], empty = 'Nessun elemento', className = '', renderLeading, renderTrailing, onPick }) {
  if (!items.length) return <div className={cx('rs-randui-datalist rs-randui-datalist--empty', className)}>{empty}</div>
  return (
    <div className={cx('rs-randui-datalist', className)}>
      {items.map((item, index) => {
        const Tag = onPick ? 'button' : 'div'
        return (
          <Tag key={item.id || index} type={onPick ? 'button' : undefined} className="rs-randui-datalist__row" onClick={onPick ? () => onPick(item) : undefined}>
            {renderLeading ? <span className="rs-randui-datalist__leading">{renderLeading(item)}</span> : null}
            <span className="rs-randui-datalist__body"><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>
            {renderTrailing ? <span className="rs-randui-datalist__trailing">{renderTrailing(item)}</span> : null}
          </Tag>
        )
      })}
    </div>
  )
}

export function CommandSurface({ title = 'Azioni rapide', items = [], onPick, className = '' }) {
  return (
    <section className={cx('rs-randui-command', className)} aria-label={title}>
      <div className="rs-randui-command__head"><strong>{title}</strong><kbd>⌘ K</kbd></div>
      <div className="rs-randui-command__grid">
        {items.map((item) => <button key={item.id} type="button" onClick={() => onPick?.(item)}><Icon name={item.icon || 'sparkles'} /><span><strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}</span></button>)}
      </div>
    </section>
  )
}

export function SkeletonBlock({ lines = 3, compact = false, className = '' }) {
  return <div className={cx('rs-randui-skeleton', compact && 'is-compact', className)} aria-hidden="true">{Array.from({ length: Math.max(1, lines) }, (_, index) => <span key={index} />)}</div>
}
