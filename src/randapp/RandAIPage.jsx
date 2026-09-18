import RandAIAssistant from '../randai/RandAIAssistant.jsx'
import { PageTitle, Stack } from './randui/visual-primitives.jsx'

export default function RandAIPage() {
  return (
    <Stack gap="sm" className="rs-randai-page" data-testid="randai-page">
      <PageTitle
        eyebrow="RANDAI"
        title="Assistente"
        subtitle="Parla con RandAI usando il contesto della struttura, dati live, memoria, procedure e storico operativo."
      />
      <RandAIAssistant embedded />
    </Stack>
  )
}
