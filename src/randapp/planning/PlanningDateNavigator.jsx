export default function PlanningDateNavigator({ label, onPrevious, onNext, onToday = null, todayLabel = 'Oggi' }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 48px', alignItems: 'center', gap: 8 }}>
        <button type="button" className="rs-btn rs-btn--ghost" onClick={onPrevious} aria-label="Periodo precedente">‹</button>
        <div style={{ textAlign: 'center', fontWeight: 800, alignSelf: 'center' }}>{label}</div>
        <button type="button" className="rs-btn rs-btn--ghost" onClick={onNext} aria-label="Periodo successivo">›</button>
      </div>
      {onToday && <button type="button" className="rs-btn rs-btn--ghost" onClick={onToday}>{todayLabel}</button>}
    </div>
  )
}
