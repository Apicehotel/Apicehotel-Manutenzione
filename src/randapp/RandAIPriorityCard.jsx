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
  return <section className="rs-randai-priority" data-testid="randai-next-work">
    <div className="rs-randai-priority__head"><span><Icon name="sparkles"/><strong>RandAI · Prossimo lavoro consigliato</strong></span><b>{item.priorityLabel}</b></div>
    <button type="button" onClick={() => onNavigate?.('issues')}>
      <span className="rs-randai-priority__main"><small>{item.room || item.category || 'Segnalazione'}</small><strong>{item.title || 'Intervento consigliato'}</strong><span>{(item.reasons || []).slice(0, 3).join(' · ')}</span></span>
      <span className="rs-randai-priority__score">{item.score}</span><Icon name="chevronRight"/>
    </button>
    {item.blockers?.length > 0 && <small className="rs-randai-priority__blocked">Blocco: {item.blockers.join(' · ')}</small>}
    {item.assignmentSuggestion && <small className="rs-randai-priority__assign">Suggerimento: {item.assignmentSuggestion}</small>}
    <style>{`.rs-randai-priority{display:grid;gap:8px;padding:14px;border:1px solid rgba(34,211,238,.35);border-radius:18px;background:linear-gradient(160deg,rgba(34,211,238,.10),var(--rs-surface));}.rs-randai-priority__head{display:flex;align-items:center;justify-content:space-between;gap:10px}.rs-randai-priority__head span{display:flex;align-items:center;gap:7px;color:var(--rs-cyan)}.rs-randai-priority__head b{font-size:.72rem;color:var(--rs-text-2)}.rs-randai-priority>button{display:grid;grid-template-columns:minmax(0,1fr) auto 18px;align-items:center;gap:10px;width:100%;padding:0;border:0;background:transparent;color:var(--rs-text);text-align:left}.rs-randai-priority__main{display:grid;gap:2px;min-width:0}.rs-randai-priority__main small{color:var(--rs-text-3);font-size:.7rem;text-transform:uppercase;font-weight:800}.rs-randai-priority__main strong{font-size:.96rem}.rs-randai-priority__main span{color:var(--rs-text-2);font-size:.78rem}.rs-randai-priority__score{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--rs-surface-3);font-weight:800}.rs-randai-priority__blocked{color:var(--rs-warn)}.rs-randai-priority__assign{color:var(--rs-text-2)}@media(max-width:520px){.rs-randai-priority{padding:12px}.rs-randai-priority__head b{display:none}}`}</style>
  </section>
}
