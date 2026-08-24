import { Card, Icon, ThemeControl, UiSizeControl } from './ui.jsx'
import { logoFor } from './helpers.js'

function Row({ label, value }) {
  return (
    <div className="rs-profile-row">
      <span>{label}</span>
      <b>{value || '—'}</b>
    </div>
  )
}

export default function Profile({ user, hotel }) {
  return (
    <div data-testid="profile-view">
      <div className="rs-page-title"><div><h1>Il mio profilo</h1><p>{hotel?.name}</p></div></div>

      <Card className="rs-card--pad rs-profile-head">
        <img src={logoFor(hotel?.id)} alt="" />
        <div>
          <strong>{user?.name || 'Utente'}</strong>
          <span className="rs-badge rs-badge--accent">{user?.role || '—'}</span>
        </div>
      </Card>

      <section className="rs-section">
        <div className="rs-section__head"><h2>Dati account</h2></div>
        <Card className="rs-card--pad">
          <Row label="Nome" value={user?.name} />
          <Row label="Ruolo" value={user?.role} />
          <Row label="Email" value={user?.email} />
          <Row label="Telefono" value={user?.phone} />
          <Row label="Struttura attiva" value={hotel?.name} />
        </Card>
      </section>

      <section className="rs-section" data-testid="profile-preferences">
        <div className="rs-section__head"><h2>Preferenze</h2></div>
        <Card className="rs-card--pad rs-pref-block">
          <div className="rs-pref">
            <div className="rs-pref__label"><Icon name="sparkles" /><div><b>Tema</b><small>Sistema segue il tuo dispositivo</small></div></div>
            <ThemeControl />
          </div>
          <div className="rs-pref">
            <div className="rs-pref__label"><Icon name="sliders" /><div><b>Dimensione interfaccia</b><small>Più contenuto o più leggibilità</small></div></div>
            <UiSizeControl />
          </div>
        </Card>
      </section>
    </div>
  )
}
