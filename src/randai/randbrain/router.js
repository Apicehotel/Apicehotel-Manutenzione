import { AgentRole } from '../agents/contracts.js'
import { BrainDomain } from './contracts.js'

const RULES={
  [BrainDomain.PROCEDURE]:[/procedur|passaggi|come si fa|istruz/i,1],
  [BrainDomain.WAREHOUSE]:[/magazz|scort|ricambio|pezzo|stock|serial/i,.98],
  [BrainDomain.SOFTWARE]:[/codice|bug|deploy|github|frontend|backend|test/i,.97],
  [BrainDomain.KNOWLEDGE]:[/manual|dove si trova|conosc|document/i,.96],
  [BrainDomain.MAINTENANCE]:[/guast|manut|ascensor|clima|sensore|lampad|intervento/i,.9],
  [BrainDomain.ANALYSIS]:[/.*/,.2],
}
const DOMAIN_ROLE={
  [BrainDomain.MAINTENANCE]:AgentRole.BUILDER,
  [BrainDomain.KNOWLEDGE]:AgentRole.RESEARCHER,
  [BrainDomain.WAREHOUSE]:AgentRole.BUILDER,
  [BrainDomain.SOFTWARE]:AgentRole.BUILDER,
  [BrainDomain.ANALYSIS]:AgentRole.REVIEWER,
  [BrainDomain.PROCEDURE]:AgentRole.REVIEWER,
}
export function routeBrainObjective(objective,{availableDomains=Object.values(BrainDomain)}={}){
  const text=String(objective||'')
  const ranked=availableDomains.map((domain,index)=>{const [regex,weight]=RULES[domain]||[/$a/,.01];return {domain,score:regex.test(text)?weight:.01,index}}).sort((a,b)=>b.score-a.score||a.index-b.index).map(({index,...x})=>x)
  const selected=ranked.filter(x=>x.score>=.5).slice(0,2)
  return {primary:(selected[0]||ranked[0])?.domain||BrainDomain.ANALYSIS,secondary:selected[1]?.domain||null,ranked}
}
export function buildBrainAgentTasks({route,objective,hotelId}={}){
  if(!route?.primary||!hotelId)throw new TypeError('route.primary and hotelId are required')
  return [...new Set([route.primary,route.secondary].filter(Boolean))].map((domain,index)=>({id:`brain-${index+1}-${domain}`,objective:`${objective} [domain:${domain}]`,agentRole:DOMAIN_ROLE[domain],hotelId,dependsOn:[],requiredTools:[],domain}))
}
