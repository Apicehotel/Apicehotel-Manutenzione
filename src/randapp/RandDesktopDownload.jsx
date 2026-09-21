import { EmptyState, Icon } from './ui.jsx'
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
    <div data-testid="randdesktop-download-view" className="rs-ops-surface">
      <PageTitle title="RandDesktop" subtitle="Applicazione Windows per le postazioni operative" />

      {runningInDesktop ? (
        <EmptyState icon="file" title="RandDesktop è già attivo">
          Questa sessione sta già girando nell’app desktop. Non serve scaricare di nuovo l’installer.
        </EmptyState>
      ) : downloadUrl ? (
        <div className="rs-migrated-list">
          <div className="rs-card rs-card--pad">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="rs-empty__icon" aria-hidden="true"><Icon name="file" /></span>
                <div style={{ minWidth: 0 }}>
                  <strong>RandDesktop per Windows</strong>
                  <p className="rs-muted" style={{ margin: '4px 0 0' }}>
                    Scarica l’installer ufficiale per il PC della reception o della direzione.
                  </p>
                </div>
              </div>
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
              <small className="rs-muted">
                Il collegamento di download è configurato centralmente: quando cambia una release non serve modificare questa pagina.
              </small>
            </div>
          </div>
        </div>
      ) : (
        <div data-testid="randdesktop-download-pending">
          <EmptyState icon="file" title="Installer in preparazione">
            L’URL di download non è ancora configurato in questo ambiente. Quando la release Windows è pronta compare qui il pulsante HTTPS.
          </EmptyState>
        </div>
      )}
    </div>
  )
}
