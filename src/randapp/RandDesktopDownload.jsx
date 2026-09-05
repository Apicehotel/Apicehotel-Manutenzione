import { Card, Icon } from './ui.jsx'
import { PageTitle } from './operations/view-primitives.jsx'

function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || '').trim())
    return url.protocol === 'https:' ? url.toString() : ''
  } catch {
    return ''
  }
}

export function randDesktopDownloadUrl() {
  return safeHttpsUrl(import.meta.env.VITE_RANDDESKTOP_DOWNLOAD_URL)
}

export default function RandDesktopDownload() {
  const downloadUrl = randDesktopDownloadUrl()
  const runningInDesktop = typeof window !== 'undefined' && Boolean(window.randDesktop)

  return (
    <div data-testid="randdesktop-download-view">
      <PageTitle title="RandDesktop" subtitle="Applicazione Windows per le postazioni operative" />
      <div className="rs-migrated-list">
        <Card className="rs-card--pad">
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="rs-empty__icon" aria-hidden="true"><Icon name="file" /></span>
              <div style={{ minWidth: 0 }}>
                <strong>{runningInDesktop ? 'RandDesktop è già attivo' : 'RandDesktop per Windows'}</strong>
                <p className="rs-muted" style={{ margin: '4px 0 0' }}>
                  {runningInDesktop
                    ? 'Questa sessione sta già girando nell’app desktop.'
                    : 'Scarica l’installer ufficiale per il PC della reception o della direzione.'}
                </p>
              </div>
            </div>

            {!runningInDesktop && downloadUrl && (
              <a
                className="rs-btn rs-btn--primary rs-btn--md"
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="randdesktop-download-link"
                style={{ width: 'fit-content' }}
              >
                <Icon name="file" />
                <span>Scarica RandDesktop</span>
              </a>
            )}

            {!runningInDesktop && !downloadUrl && (
              <div className="rs-badge rs-badge--accent" data-testid="randdesktop-download-pending" style={{ width: 'fit-content' }}>
                Installer in preparazione
              </div>
            )}

            <small className="rs-muted">
              Il collegamento di download è configurato centralmente: quando cambia una release non serve modificare questa pagina.
            </small>
          </div>
        </Card>
      </div>
    </div>
  )
}
