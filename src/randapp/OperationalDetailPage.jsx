import { useEffect, useRef } from 'react'
import { Button } from './ui.jsx'
import './operational-detail.css'

export const OPERATIONAL_DETAIL_KINDS = Object.freeze(['issue', 'intervention', 'task', 'supply'])

export function OperationalDock({ onBack, primaryAction = null }) {
  return (
    <footer className="rs-operational-detail__footer" data-testid="operational-dock">
      <div className="rs-operational-detail__inner rs-operational-dock">
        <Button variant="ghost" icon="chevronLeft" onClick={onBack} data-testid="operational-detail-back">Indietro</Button>
        {primaryAction && (
          <Button
            variant={primaryAction.variant || 'primary'}
            icon={primaryAction.icon || 'check'}
            disabled={Boolean(primaryAction.disabled || primaryAction.busy)}
            aria-busy={primaryAction.busy ? 'true' : undefined}
            onClick={primaryAction.onClick}
            data-testid="operational-primary-action"
          >
            {primaryAction.busy ? (primaryAction.busyLabel || 'Attendi…') : primaryAction.label}
          </Button>
        )}
      </div>
    </footer>
  )
}

export default function OperationalDetailPage({ kind, resourceId, title, subtitle, onBack, primaryAction = null, children, className = '' }) {
  const pageRef = useRef(null)
  const supported = OPERATIONAL_DETAIL_KINDS.includes(kind)

  useEffect(() => {
    pageRef.current?.focus?.()
  }, [kind, resourceId])

  if (!supported) throw new Error(`Unsupported operational detail kind: ${kind}`)

  return (
    <section
      ref={pageRef}
      tabIndex={-1}
      className={`rs-operational-detail ${className}`}
      data-testid="operational-detail"
      data-operational-kind={kind}
      data-operational-id={resourceId == null ? undefined : String(resourceId)}
      aria-label={title || 'Dettaglio operativo'}
    >
      <header className="rs-operational-detail__head">
        <div className="rs-operational-detail__inner">
          <small className="rs-operational-detail__eyebrow">RandApp · Focus operativo</small>
          <h1>{title || 'Dettaglio operativo'}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>
      <div className="rs-operational-detail__body">
        <div className="rs-operational-detail__inner">{children}</div>
      </div>
      <OperationalDock onBack={onBack} primaryAction={primaryAction} />
    </section>
  )
}
