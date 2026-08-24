import { Icon } from './ui.jsx'

export default function SoonScreen({ icon = 'sparkles', title = 'RandApp', desc }) {
  return (
    <section className="rs-soon" data-testid="soon-screen">
      <span className="rs-soon__badge"><Icon name={icon} /></span>
      <h2>{title}</h2>
      <p>{desc || 'Questa sezione verrà collegata alla logica esistente mantenendo il design system RandApp Dark Shell.'}</p>
      <span className="rs-badge rs-badge--accent">Migrazione in corso</span>
    </section>
  )
}
