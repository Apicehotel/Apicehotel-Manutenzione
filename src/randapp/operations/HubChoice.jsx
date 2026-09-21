import { Icon } from '../ui.jsx'
import { Grid, Metric } from '../randui/visual-primitives.jsx'

/** Shared Planning-style preview card: title row + three compact metrics. */
export default function HubChoice({
  active = false,
  icon,
  title,
  metrics = [],
  onClick,
  testId,
  kind,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active || undefined}
      data-testid={testId}
      data-hub-kind={kind || icon}
      className={`rs-randui-choice ${active ? 'is-active' : ''}`.trim()}
    >
      <div className="rs-randui-choice__head">
        <span className="rs-randui-choice__icon" aria-hidden="true"><Icon name={icon} /></span>
        <strong>{title}</strong>
        <span className="rs-randui-choice__chevron" aria-hidden="true">›</span>
      </div>
      <Grid columns={3} gap="xs" className="rs-randui-grid--keep-mobile">
        {metrics.map((metric) => (
          <Metric
            key={metric.label}
            compact
            value={metric.value}
            label={metric.label}
            tone={metric.tone || 'default'}
          />
        ))}
      </Grid>
    </button>
  )
}
