import RandAIAssistant from '../randai/RandAIAssistant.jsx'
import { PageTitle, Stack } from './randui/visual-primitives.jsx'

export default function RandAIPage() {
  return (
    <Stack gap="sm" className="rs-randai-page" data-testid="randai-page">
      <PageTitle
        eyebrow="RANDAI"
        title="RandAI"
        subtitle="Intelligenza operativa della struttura: osserva, collega, ricorda e ti aiuta a decidere cosa controllare dopo."
      />
      <RandAIAssistant embedded />
    </Stack>
  )
}
