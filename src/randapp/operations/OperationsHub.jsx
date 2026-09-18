import { Icon } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'

function OperationalChoice({ icon, title, description, onClick, testId }) {
  return (
    <button type="button" className="rs-randui-choice rs-operational-choice" onClick={onClick} data-testid={testId}>
      <div className="rs-randui-choice__head">
        <span className="rs-randui-choice__icon" aria-hidden="true"><Icon name={icon} /></span>
        <strong>{title}</strong>
        <span className="rs-randui-choice__chevron" aria-hidden="true">›</span>
      </div>
      <p className="rs-operational-choice__description">{description}</p>
    </button>
  )
}

export default function OperationsHub({ canIssues, canInterventions, onOpen }) {
  const visibleCount = Number(Boolean(canIssues)) + Number(Boolean(canInterventions))
  return (
    <Stack gap="sm" className="rs-operations-hub" data-testid="operations-hub">
      <PageTitle
        title="Operatività"
        subtitle="Segnalazioni e interventi nello stesso punto, con flussi separati e coerenti."
      />
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-choice-grid">
        {canIssues && (
          <OperationalChoice
            icon="issues"
            title="Segnalazioni"
            description="Apri, filtra e crea segnalazioni operative."
            onClick={() => onOpen('issues')}
            testId="operations-open-issues"
          />
        )}
        {canInterventions && (
          <OperationalChoice
            icon="wrench"
            title="Interventi"
            description="Consulta assegnazioni, stato lavori e risoluzioni."
            onClick={() => onOpen('interventions')}
            testId="operations-open-interventions"
          />
        )}
      </Grid>
    </Stack>
  )
}
