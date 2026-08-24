import { useEffect, useState } from 'react'
import { UI_SIZES, loadUiSize, setUiSize } from './ui-size.js'
import { THEMES, loadThemeChoice, setThemeChoice } from './theme.js'

const ICONS = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  issues: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4V2.8h6V4M9 10h6M9 14h4" /></>,
  wrench: <path d="M15 5.5a4 4 0 0 0-5.3 4.9L4 16.1a2.1 2.1 0 0 0 3 3l5.7-5.7A4 4 0 0 0 17.6 8l-2.4 2.4-2-2L15.6 6" />,
  calendar: <><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M16 3v4M8 3v4M3.5 10h17" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-3.8-3.8" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 6-6 6 6 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  users: <><circle cx="9" cy="8" r="3.4" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.2a3.4 3.4 0 0 1 0 6.6M17.5 20a6 6 0 0 0-3-5.2" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6" /></>,
  logout: <><path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" /><path d="M10 12h11M18 9l3 3-3 3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3Z" /><circle cx="12" cy="13" r="3.2" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="8.5" cy="9" r="1.6" /><path d="m21 15-5-5L5 20" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  package: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z" /><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v9" /></>,
  message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.1 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7A2 2 0 0 1 22 16.9Z" />,
  thermometer: <><path d="M14 14.8V5a2.5 2.5 0 0 0-5 0v9.8a5 5 0 1 0 5 0Z" /><path d="M11.5 9v7" /></>,
  housekeeping: <><path d="M4 6h16v15H4z" /><path d="M8 3v4M16 3v4M4 11h16M8 15h3M8 18h8" /></>,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M18.6 9A7 7 0 0 0 6 6.7L4 12M6 15a7 7 0 0 0 12.4 2.3L20 12" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10.5" rx="2.2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></>,
  arrowRight: <path d="M5 12h14M14 6l6 6-6 6" />,
  hotel: <><path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M9 21v-5h6v5" /><path d="M3 21h18" /></>,
  shield: <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />,
  sparkles: <path d="M12 3l1.8 4.9L18.7 9l-4.9 1.8L12 15.7l-1.8-4.9L5.3 9l4.9-1.8L12 3ZM19 14l.9 2.4 2.4.9-2.4.9L19 21l-.9-2.4-2.4-.9 2.4-.9L19 14Z" />,
  warning: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  book: <><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" /><path d="M5 18a2 2 0 0 1 2-2h11" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="M14 6l4 4" /></>,
  trash: <><path d="M4 7h16M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M6.5 7l1 12a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12" /></>,
  link: <><path d="M9 15l6-6" /><path d="M10.5 6.5 12 5a4 4 0 0 1 5.7 5.7L16 12.5M7.5 11.5 6 13a4 4 0 0 0 5.7 5.7L13 17.5" /></>,
  sensor: <><circle cx="12" cy="12" r="2.4" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 16.2a6 6 0 0 0 0-8.4M5 5a9.5 9.5 0 0 0 0 14M19 19a9.5 9.5 0 0 0 0-14" /></>,
  sliders: <><path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2" /><circle cx="9" cy="16" r="2" /></>,
}

export function Icon({ name, className = '' }) {
  return (
    <svg className={`rs-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name] || null}
    </svg>
  )
}

export function Button({ variant = 'primary', size = 'md', icon, iconRight, children, className = '', ...rest }) {
  return (
    <button className={`rs-btn rs-btn--${variant} rs-btn--${size} ${className}`} {...rest}>
      {icon && <Icon name={icon} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} />}
    </button>
  )
}

export function IconButton({ icon, label, className = '', ...rest }) {
  return (
    <button className={`rs-iconbtn ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return <Tag className={`rs-card ${className}`} {...rest}>{children}</Tag>
}

export function Field({ label, hint, error, children }) {
  return (
    <label className="rs-field">
      {label && <span className="rs-field__label">{label}</span>}
      {children}
      {error ? <small className="rs-field__error">{error}</small> : hint ? <small className="rs-field__hint">{hint}</small> : null}
    </label>
  )
}

export function TextInput({ icon, className = '', ...rest }) {
  return (
    <div className={`rs-input ${icon ? 'rs-input--icon' : ''} ${className}`}>
      {icon && <Icon name={icon} />}
      <input {...rest} />
    </div>
  )
}

export function Badge({ tone = 'default', children, className = '' }) {
  return <span className={`rs-badge rs-badge--${tone} ${className}`}>{children}</span>
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`rs-segmented ${className}`} role="tablist">
      {options.map(([key, label, count]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)} type="button">
          <span>{label}</span>
          {count != null && <b className="rs-segmented__count">{count}</b>}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label }) {
  return <div className="rs-spinner" role="status"><span className="rs-spinner__ring" />{label && <small>{label}</small>}</div>
}

export function EmptyState({ icon = 'sparkles', title, children }) {
  return (
    <div className="rs-empty">
      <span className="rs-empty__icon"><Icon name={icon} /></span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  )
}

function useLockScroll(active) {
  useEffect(() => {
    if (!active) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [active])
}

export function Sheet({ open, onClose, title, children, className = '' }) {
  useLockScroll(open)
  if (!open) return null
  return (
    <div className="rs-overlay" onClick={onClose}>
      <section className={`rs-sheet ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <span className="rs-sheet__handle" />
        {title && <header className="rs-sheet__head"><h3>{title}</h3><IconButton icon="close" label="Chiudi" onClick={onClose} /></header>}
        <div className="rs-sheet__body">{children}</div>
      </section>
    </div>
  )
}

export function Modal({ open, onClose, title, subtitle, children, className = '' }) {
  useLockScroll(open)
  if (!open) return null
  return (
    <div className="rs-overlay rs-overlay--center" onClick={onClose}>
      <section className={`rs-modal ${className}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {(title || onClose) && (
          <header className="rs-modal__head">
            <div>{title && <h3>{title}</h3>}{subtitle && <p>{subtitle}</p>}</div>
            <IconButton icon="close" label="Chiudi" onClick={onClose} />
          </header>
        )}
        <div className="rs-modal__body">{children}</div>
      </section>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Conferma', danger, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="rs-confirm__msg">{message}</p>
      <div className="rs-modal__actions">
        <Button variant="ghost" onClick={onCancel}>Annulla</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function UiSizeControl({ className = '' }) {
  const [value, setValue] = useState(loadUiSize())
  useEffect(() => {
    const onChange = (event) => setValue(event.detail?.value || loadUiSize())
    window.addEventListener('apice-ui-size-changed', onChange)
    return () => window.removeEventListener('apice-ui-size-changed', onChange)
  }, [])
  const pick = (next) => { setUiSize(next); setValue(next) }
  return (
    <div className={`rs-segmented rs-uisize ${className}`} role="group" aria-label="Dimensione interfaccia">
      {UI_SIZES.map(([key, label]) => (
        <button key={key} type="button" className={value === key ? 'active' : ''} aria-pressed={value === key}
          onClick={() => pick(key)} data-testid={`ui-size-${key}`}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function ThemeControl({ className = '' }) {
  const [choice, setChoice] = useState(loadThemeChoice())
  useEffect(() => {
    const onChange = (event) => setChoice(event.detail?.choice || loadThemeChoice())
    window.addEventListener('apice-theme-changed', onChange)
    return () => window.removeEventListener('apice-theme-changed', onChange)
  }, [])
  const pick = (next) => { setThemeChoice(next); setChoice(next) }
  return (
    <div className={`rs-segmented rs-uisize ${className}`} role="group" aria-label="Tema">
      {THEMES.map(([key, label]) => (
        <button key={key} type="button" className={choice === key ? 'active' : ''} aria-pressed={choice === key}
          onClick={() => pick(key)} data-testid={`theme-${key}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
