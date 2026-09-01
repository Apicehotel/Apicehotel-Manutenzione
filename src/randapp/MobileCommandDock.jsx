import { useRef, useState } from 'react'
import { Icon } from './ui.jsx'

const SWIPE_Y = 42

export default function MobileCommandDock({
  navItems,
  activeView,
  onNavigate,
  canCreate,
  onCreate,
  onRandAI,
  onQuickIssue,
  onQuickIntervention,
  onQuickPlanning,
  onQuickInventory,
}) {
  const [open, setOpen] = useState(false)
  const gesture = useRef(null)

  const close = () => setOpen(false)

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now() }
  }

  const onPointerUp = (event) => {
    const start = gesture.current
    gesture.current = null
    if (!start || start.id !== event.pointerId) return
    const dy = event.clientY - start.y
    const dx = event.clientX - start.x
    const elapsed = performance.now() - start.at
    if (elapsed > 700 || Math.abs(dy) < SWIPE_Y || Math.abs(dy) < Math.abs(dx) * 1.2) return
    setOpen(dy < 0)
  }

  const action = (fn) => {
    close()
    fn?.()
  }

  return (
    <section
      className={`rs-mobile-dock lg-surface ${open ? 'is-open' : ''}`}
      data-testid="mobile-command-dock"
      aria-label="Navigazione e azioni rapide"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { gesture.current = null }}
    >
      {open && <button className="rs-mobile-dock__backdrop" aria-label="Chiudi azioni rapide" onClick={close} />}

      <div className="rs-mobile-dock__panel" aria-hidden={!open}>
        <div className="rs-mobile-dock__panelhead">
          <div><strong>Azioni rapide</strong><small>Scorri verso il basso per chiudere</small></div>
          <button type="button" className="rs-mobile-dock__close" onClick={close} aria-label="Chiudi"><Icon name="close" /></button>
        </div>
        <div className="rs-mobile-dock__actions">
          <button type="button" onClick={() => action(onQuickIssue)}><Icon name="plus" /><span><b>Nuova segnalazione</b><small>Apri un nuovo problema</small></span></button>
          <button type="button" onClick={() => action(onQuickIntervention)}><Icon name="wrench" /><span><b>Nuovo intervento</b><small>Pianifica il lavoro</small></span></button>
          <button type="button" onClick={() => action(onQuickPlanning)}><Icon name="calendar" /><span><b>Planning</b><small>Lavori e sale</small></span></button>
          <button type="button" onClick={() => action(onQuickInventory)}><Icon name="package" /><span><b>Magazzino</b><small>Scorte e ricambi</small></span></button>
        </div>
        <button type="button" className="rs-mobile-dock__airow" onClick={() => action(onRandAI)}><Icon name="sparkles" /><span><b>RandAI</b><small>Assistente operativo contestuale</small></span><Icon name="chevronRight" /></button>
      </div>

      <div className="rs-mobile-dock__crown">
        {canCreate && <button type="button" className="rs-mobile-dock__primary" onClick={onCreate} data-testid="dock-new"><Icon name="plus" /><span>Nuovo</span></button>}
        <button type="button" className="rs-mobile-dock__ai" onClick={onRandAI} data-testid="dock-randai"><Icon name="sparkles" /><span>RandAI</span></button>
      </div>

      <nav className="rs-bottomnav rs-bottomnav--integrated" data-count="5" data-testid="bottom-nav" aria-label="Navigazione principale">
        {navItems.map((item) => (
          <button
            key={item.id}
            data-slot={item.slot}
            className={`rs-navbtn ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item)}
            data-testid={`nav-${item.id}`}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <Icon name={item.icon} /><small>{item.label}</small>
          </button>
        ))}
      </nav>
    </section>
  )
}
