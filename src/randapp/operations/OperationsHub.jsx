import { Icon } from '../ui.jsx'
import { PageTitle, Stack, Surface } from '../randui/visual-primitives.jsx'
import PlanningCountCards from '../planning/PlanningCountCards.jsx'

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

export default function OperationsHub({ canIssues, canInterventions, hotel, user, onOpen }) {
  return (
    <Stack gap="sm" className="rs-operations-hub rs-ops-surface">
      <PageTitle
        title="Operatività"
        subtitle="Segnalazioni e interventi adesso. Planning resta sotto come scorciatoia."
      />
      <Surface padded={false} className="rs-telegram-list" aria-label="Funzioni operative">
        {canIssues && (
          <DestinationRow
            icon="issues"
            title="Segnalazioni"
            description="Apri, filtra e crea segnalazioni."
            onClick={() => onOpen('issues')}
            testId="operations-open-issues"
          />
        )}
        {canInterventions && (
          <DestinationRow
            icon="wrench"
            title="Interventi"
            description="Assegnazioni, stato lavori e risoluzioni."
            onClick={() => onOpen('interventions')}
            testId="operations-open-interventions"
          />
        )}
      </Surface>
      <PlanningCountCards hotel={hotel} user={user} onOpen={onOpen} className="rs-planning-counts--compact" />
      <p className="rs-telegram-hint">Il menu completo resta dal profilo in alto. Ogni voce rispetta i permessi del ruolo.</p>
    </Stack>
  )
}
