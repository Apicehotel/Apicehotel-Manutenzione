import { Component } from 'react'

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
    import('./diagnostics-client.js').then(({ reportDiagnosticEvent }) => reportDiagnosticEvent({
      severity: 'fatal',
      kind: 'react-render',
      message: error?.message || 'Errore render React',
      detail: `${error?.stack || ''}\n${info?.componentStack || ''}`,
    })).catch(() => {})
    import('./external-telemetry.js').then(({ captureExternalError }) => captureExternalError(error, {
      source: 'react-render',
      componentStack: String(info?.componentStack || '').slice(0, 2000),
    })).catch(() => {})
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#1b2420', background: '#f4f2ed', minHeight: '100vh' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Si è verificato un errore</h1>
          <p style={{ fontSize: 14, color: '#5c645e', marginBottom: 16 }}>
            RandApp ha registrato il problema nella diagnostica. Puoi provare a riprendere senza ricaricare oppure ricaricare l'app.
          </p>
          <pre style={{
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#fff', border: '1px solid #e4e0d6',
            borderRadius: 10, padding: 12, fontSize: 12, color: '#b23a2e', marginBottom: 16,
          }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '10px 18px', marginRight: 8, borderRadius: 10, border: '1px solid #0e5c49', background: 'transparent', color: '#0e5c49', fontWeight: 700 }}
          >
            Riprova
          </button>
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
