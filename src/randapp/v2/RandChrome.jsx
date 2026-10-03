import { useRef } from 'react'
import { Icon } from '../ui.jsx'

export function RandDesktopSidebar({ brand, switcher, navigation, preferences, onLogout }) {
  return (
    <aside className="rv2-sidebar" data-testid="sidebar" aria-label="Navigazione desktop">
      <div className="rv2-sidebar__brand">{brand}</div>
      {switcher && <div className="rv2-sidebar__switcher">{switcher}</div>}
      <div className="rv2-sidebar__search" aria-hidden="true">
        <Icon name="search" /><span>Cerca</span><kbd>⌘K</kbd>
      </div>
      <div className="rv2-sidebar__scroll">{navigation}</div>
      <div className="rv2-sidebar__footer">
        {preferences}
        <button type="button" className="rv2-sidebar__logout" onClick={onLogout} data-testid="sidebar-logout">
          <Icon name="logout" /><span>Esci</span>
        </button>
      </div>
    </aside>
  )
}

export function RandTopbar({ hotel, profile, presence, notifications, randai }) {
  return (
    <header className="rv2-topbar">
      <div className="rv2-topbar__hotel">{hotel}</div>
      <div className="rv2-topbar__actions">
        {presence}
        {notifications}
        {randai}
        {profile}
      </div>
    </header>
  )
}

export function RandMobileNav({ items, isActive, onPick, onWarm }) {
  return (
    <nav className="rv2-bottomnav" data-count="5" data-testid="bottom-nav" aria-label="Navigazione principale">
      {items.map((item) => {
        const active = isActive(item)
        return (
          <button
            key={`${item.id}-${item.slot}`}
            type="button"
            data-slot={item.slot}
            className={`rv2-bottomnav__item rs-navbtn ${active ? 'active' : ''}`}
            onPointerDown={() => onWarm?.(item.id)}
            onFocus={() => onWarm?.(item.id)}
            onClick={() => onPick(item)}
            data-testid={`nav-${item.id}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="rv2-bottomnav__icon"><Icon name={item.icon} /></span>
            <small>{item.label}</small>
          </button>
        )
      })}
    </nav>
  )
}

export function RandSwipeStage({ children, items, isActive, onPick }) {
  const start = useRef(null)
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse') return
    start.current = { x: event.clientX, y: event.clientY }
  }
  const onPointerUp = (event) => {
    const origin = start.current
    start.current = null
    if (!origin || items.length < 2) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.25) return
    const index = Math.max(0, items.findIndex(isActive))
    const nextIndex = dx < 0 ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1)
    if (nextIndex !== index) onPick(items[nextIndex])
  }
  return <div className="rv2-stage" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => { start.current = null }}>{children}</div>
}
