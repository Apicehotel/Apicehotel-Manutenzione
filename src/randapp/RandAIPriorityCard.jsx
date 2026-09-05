import { useQuery } from '@tanstack/react-query'
import { fetchRandAIPriorities } from '../randai/prioritization-client.js'
import { Icon } from './ui.jsx'

export default function RandAIPriorityCard({ hotel, user, onNavigate }) {
  const query = useQuery({
    queryKey: ['randai-priority', hotel?.id, user?.role, user?.name],
    queryFn: () => fetchRandAIPriorities({ hotelId: hotel.id, user }),
    enabled: Boolean(hotel?.id),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  const item = query.data?.recommendation
  if (query.isPending || query.isError || !item) return null

  const reasonSummary = (item.reasons || []).slice(0, 2).join(' · ')
  return <section className="rs-randai-priority" data-testid="randai-next-work">
    <div className="rs-randai-priority__head"><span><Icon name="sparkles"/><strong>RandAI · Prossimo lavoro consigliato</strong></span><b>{item.priorityLabel}</b></div>
    <button type="button" onClick={() => onNavigate?.('issues')} aria-label={`Apri lavoro consigliato: ${item.title || 'Intervento consigliato'}`}>
      <span className="rs-randai-priority__main"><small>{item.room || item.category || 'Segnalazione'}</small><strong>{item.title || 'Intervento consigliato'}</strong>{reasonSummary&&<span>{reasonSummary}</span>}</span>
      <span className="rs-randai-priority__score">Priorità {item.score}</span><Icon name="chevronRight"/>
    </button>
    {item.blockers?.length > 0 && <small className="rs-randai-priority__blocked">Blocco: {item.blockers.join(' · ')}</small>}
    {item.assignmentSuggestion && <small className="rs-randai-priority__assign">Suggerimento: {item.assignmentSuggestion}</small>}
  </section>
}
