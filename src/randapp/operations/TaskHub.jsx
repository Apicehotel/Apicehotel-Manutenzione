import { Icon } from '../ui.jsx'
import { Grid, PageTitle, Stack } from '../randui/visual-primitives.jsx'

function TaskChoice({ icon, title, description, onClick, testId }) {
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

export default function TaskHub({ canReminders, canUrgent, onOpen }) {
  const visibleCount = Number(Boolean(canReminders)) + Number(Boolean(canUrgent))
  return (
    <Stack gap="sm" className="rs-task-hub" data-testid="task-hub">
      <PageTitle title="Task" subtitle="Promemoria e avvisi nello stesso punto, separati per funzione." />
      <Grid columns={visibleCount > 1 ? 2 : 1} gap="sm" className="rs-operational-choice-grid">
        {canReminders && (
          <TaskChoice
            icon="bell"
            title="Promemoria"
            description="Consulta e gestisci i promemoria della struttura."
            onClick={() => onOpen('reminders')}
            testId="task-open-reminders"
          />
        )}
        {canUrgent && (
          <TaskChoice
            icon="warning"
            title="Avvisi"
            description="Apri e gestisci gli avvisi urgenti ancora attivi."
            onClick={() => onOpen('urgent')}
            testId="task-open-urgent"
          />
        )}
      </Grid>
    </Stack>
  )
}
