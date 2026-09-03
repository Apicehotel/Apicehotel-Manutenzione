import { BrainDomain } from './contracts.js'
const RULES=[
  [BrainDomain.WAREHOUSE,/magazz|scort|ricambio|pezzo|stock|serial/i],
  [BrainDomain.PROCEDURE,/procedur|passaggi|come si fa|istruz/i],
  [BrainDomain.SOFTWARE,/codice|bug|deploy|github|frontend|backend|test/i],
  [BrainDomain.MAINTENANCE,/guast|manut|ascensor|clima|sensore|lampad|intervento/i],
  [BrainDomain.KNOWLEDGE,/manual|dove si trova|conosc|document/i],
]
export function routeBrainObjective(objective,{availableDomains=Object.values(BrainDomain)}={}){
  const text=String(objective||'')
  const ranked=[]
  for(const domain of availableDomains){const rule=RULES.find(([d])=>d===domain);let score=domain===BrainDomain.ANALYSIS?.2:.05;if(rule&&rule[1].test(text))score=.95;ranked.push({domain,score})}
  ranked.sort((a,b)=>b.score-a.score)
  const selected=ranked.filter(x=>x.score>=.5).slice(0,2)
  return {primary:(selected[0]||ranked[0])?.domain||BrainDomain.ANALYSIS,secondary:selected[1]?.domain||null,ranked}
}
