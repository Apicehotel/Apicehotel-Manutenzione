import './tokens.css'
import './shell.css'

export default function AppShell({ header, sidebar, drawer, bottomNav, children }) {
  return (
    <div className="rui-shell">
      <div className="rui-shell__header">{header}</div>
      <div className="rui-shell__body">
        <aside className="rui-shell__sidebar" aria-label="Navigazione principale">{sidebar}</aside>
        <main className="rui-shell__viewport" id="main-content">
          <div className="rui-shell__content">{children}</div>
        </main>
      </div>
      <div className="rui-shell__drawer">{drawer}</div>
      <nav className="rui-shell__bottom" aria-label="Navigazione mobile">{bottomNav}</nav>
    </div>
  )
}
