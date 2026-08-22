import { Component } from 'react'

// Senza un error boundary, qualsiasi eccezione React durante il render fa
// scomparire l'intero albero e lascia lo schermo bianco, senza nessun indizio
// su cosa sia successo. Questo la intercetta e mostra il messaggio reale,
// con un pulsante per ricaricare, così un errore diventa diagnosticabile
// invece che un "non vedo niente" muto.
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1b2420', background: '#f4f2ed', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Si è verificato un errore</h1>
          <p style={{ fontSize: 14, color: '#5c645e', marginBottom: 16 }}>
            L'app ha incontrato un problema imprevisto. Il messaggio qui sotto aiuta a capire cosa è successo — puoi
            farne uno screenshot.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff', border: '1px solid #e4e0d6',
            borderRadius: 10, padding: 12, fontSize: 12, color: '#b23a2e', marginBottom: 16,
          }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#0e5c49', color: '#fff', fontWeight: 700 }}
          >
            Ricarica l'app
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
