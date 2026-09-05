import { Button, Icon } from '../ui.jsx'
import { RANDUI_SYSTEM_STATES } from './design-contract.js'

const STATE_META = Object.freeze({
  loading: { icon:'refresh', tone:'info', title:'Caricamento' },
  empty: { icon:'sparkles', tone:'neutral', title:'Nessun contenuto' },
  'no-results': { icon:'search', tone:'neutral', title:'Nessun risultato' },
  error: { icon:'warning', tone:'danger', title:'Si è verificato un errore' },
  degraded: { icon:'warning', tone:'warning', title:'Servizio parzialmente disponibile' },
  offline: { icon:'warning', tone:'warning', title:'Sei offline' },
  queued: { icon:'clock', tone:'info', title:'Operazione in coda' },
  syncing: { icon:'refresh', tone:'info', title:'Sincronizzazione' },
  stale: { icon:'clock', tone:'warning', title:'Dati non aggiornati' },
  conflict: { icon:'warning', tone:'danger', title:'Modifica in conflitto' },
  forbidden: { icon:'lock', tone:'danger', title:'Accesso non consentito' },
  unavailable: { icon:'warning', tone:'neutral', title:'Contenuto non disponibile' },
  success: { icon:'check', tone:'success', title:'Operazione completata' },
  warning: { icon:'warning', tone:'warning', title:'Attenzione' },
  'in-progress': { icon:'clock', tone:'info', title:'Operazione in corso' },
})

const BUSY_STATES = new Set(['loading', 'syncing', 'in-progress'])

export function systemStateMeta(state) {
  return STATE_META[state] || null
}

export default function SystemState({
  state = 'empty',
  title,
  message,
  children,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  className = '',
}) {
  const meta = systemStateMeta(state) || STATE_META.unavailable
  const busy = BUSY_STATES.has(state)
  const role = ['error', 'conflict', 'forbidden'].includes(state) ? 'alert' : 'status'
  return (
    <section
      className={`rs-randui-state rs-randui-state--${meta.tone} ${compact ? 'rs-randui-state--compact' : ''} ${className}`}
      data-randui-state={state}
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      aria-busy={busy || undefined}
    >
      <span className={`rs-randui-state__icon ${busy ? 'is-busy' : ''}`}><Icon name={meta.icon} /></span>
      <div className="rs-randui-state__copy">
        <strong>{title || meta.title}</strong>
        {message && <p>{message}</p>}
        {children}
      </div>
      {(actionLabel || secondaryActionLabel) && (
        <div className="rs-randui-state__actions">
          {actionLabel && <Button type="button" variant="primary" onClick={onAction}>{actionLabel}</Button>}
          {secondaryActionLabel && <Button type="button" variant="ghost" onClick={onSecondaryAction}>{secondaryActionLabel}</Button>}
        </div>
      )}
    </section>
  )
}

export function isRandUiSystemState(value) {
  return RANDUI_SYSTEM_STATES.includes(value)
}
