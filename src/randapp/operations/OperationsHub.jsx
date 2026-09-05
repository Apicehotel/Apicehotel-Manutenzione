import { Icon } from '../ui.jsx'
import { PageTitle, Stack, Surface } from '../randui/visual-primitives.jsx'

function DestinationRow({ icon, title, description, onClick, testId }) {
  return (
    <button type="button" className="rs-telegram-destination" onClick={onClick} data-testid={testId}>
      <span className="rs-telegram-destination__icon" aria-hidden="true"><Icon name={icon} /></span>
      <span className="rs-telegram-destination__copy">
        <b>{title}</b>
        <small>{description}</small>
      </span>
      <span className="rs-telegram-destination__chevron" aria-hidden="true"><Icon name="chevronRight" /></span>
    </button>
  )
}

export default function OperationsHub({ canIssues, canInterventions, onOpen }) {
  return (
    <Stack gap="md" className="rs-operations-hub">
      <PageTitle
        eyebrow="RandApp"
        title="Operatività"
        subtitle="Segnalazioni e interventi nello stesso punto, senza mescolare i relativi flussi."
      />
      <Surface padded={false} className="rs-telegram-list" aria-label="Funzioni operative">
        {canIssues && (
          <DestinationRow
            icon="issues"
            title="Segnalazioni"
            description="Apri, filtra e crea segnalazioni operative."
            onClick={() => onOpen('issues')}
            testId="operations-open-issues"
          />
        )}
        {canInterventions && (
          <DestinationRow
            icon="wrench"
            title="Interventi"
            description="Consulta assegnazioni, stato lavori e risoluzioni."
            onClick={() => onOpen('interventions')}
            testId="operations-open-interventions"
          />
        )}
      </Surface>
      <p className="rs-telegram-hint">Il menu completo resta disponibile dal profilo in alto. Ogni voce continua a rispettare i permessi del ruolo.</p>
    </Stack>
  )
}
