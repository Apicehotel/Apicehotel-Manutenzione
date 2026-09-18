export const WORLD_ZONES=Object.freeze({
 entrance:{id:'entrance',label:'Ingresso',x:8,y:56},
 reception:{id:'reception',label:'Reception',x:24,y:36},
 waitingA:{id:'waitingA',label:'Sala attesa A',x:30,y:68},
 waitingB:{id:'waitingB',label:'Sala attesa B',x:48,y:72},
 waitingC:{id:'waitingC',label:'Sala attesa C',x:66,y:68},
 elevators:{id:'elevators',label:'Ascensori',x:50,y:18},
 core:{id:'core',label:'RandCore Hub',x:50,y:40},
 knowledge:{id:'knowledge',label:'Knowledge',x:68,y:24},
 research:{id:'research',label:'Research',x:84,y:24},
 radar:{id:'radar',label:'Radar',x:87,y:64},
 secure:{id:'secure',label:'Security',x:72,y:42},
 qa:{id:'qa',label:'RandTest',x:69,y:70},
 ops:{id:'ops',label:'RandOps',x:86,y:42},
 design:{id:'design',label:'RandUI',x:85,y:54},
 brain:{id:'brain',label:'RandBrain',x:15,y:22},
 cafe:{id:'cafe',label:'Coffee',x:34,y:20},
 service:{id:'service',label:'Service',x:13,y:72},
 exit:{id:'exit',label:'Uscita',x:92,y:80},
})

export const AGENT_HOME=Object.freeze({
 randai:'reception',randbrain:'brain',randcore:'core',randmind:'knowledge',randradar:'radar',
 randresearch:'research',randsecure:'secure',randtest:'qa',randops:'ops',randui:'design',
})

const SOCIAL={
 randai:['reception','waitingA','cafe','core'],
 randbrain:['brain','cafe','knowledge','core'],
 randcore:['core','reception','secure','ops'],
 randmind:['knowledge','cafe','research','waitingB'],
 randradar:['radar','entrance','research','cafe'],
 randresearch:['research','knowledge','cafe','waitingC'],
 randsecure:['secure','entrance','core','waitingC'],
 randtest:['qa','ops','waitingB','cafe'],
 randops:['ops','service','core','cafe'],
 randui:['design','waitingA','qa','cafe'],
}

function hash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
const pick=(list,seed)=>list[seed%list.length]

export function agentLife(agent,now=Date.now()){
 const status=agent.status
 if(status==='ERROR')return{mode:'ALERT',zone:agent.id==='randsecure'?'secure':'core',action:agent.detail||'Gestisce un allarme'}
 if(status==='WAITING_APPROVAL')return{mode:'WAIT',zone:'reception',action:'Attende approvazione'}
 if(status==='RUNNING')return{mode:'WORK',zone:AGENT_HOME[agent.id]||'core',action:agent.activity||'Missione reale in corso'}
 const slot=Math.floor(now/9000)
 const seed=hash(agent.id+':'+slot)
 const zones=SOCIAL[agent.id]||['core']
 const zone=pick(zones,seed)
 const actions={
  cafe:['Prende un caffè','Parla con un collega','Pausa breve'],reception:['Controlla nuovi clienti','Accoglie una segnalazione','Smista richieste'],
  waitingA:['Controlla la coda','Parla con un cliente','Osserva le priorità'],waitingB:['Rivede le attese','Incrocia gli altri Rand','Fa una ronda'],
  waitingC:['Segue un caso','Controlla un cliente','Raccoglie informazioni'],core:['Coordina il sistema','Controlla il flusso','Sincronizza i Rand'],
  knowledge:['Consulta la memoria','Riordina conoscenza','Legge lo storico'],research:['Cerca cause','Confronta dati','Approfondisce un caso'],
  radar:['Scansiona la hall','Cerca segnali','Controlla anomalie'],secure:['Controlla accessi','Fa una ronda','Verifica sicurezza'],
  qa:['Verifica chiusure','Controlla esiti','Esegue checklist'],ops:['Controlla operazioni','Segue interventi','Verifica i servizi'],
  design:['Rivede la UI','Osserva il flusso','Sistema la leggibilità'],brain:['Pianifica','Ragiona sulle priorità','Prepara una strategia'],
  entrance:['Osserva gli ingressi','Controlla nuovi arrivi'],service:['Controlla il service','Segue il personale']
 }
 return{mode:status==='OFFLINE'?'REST':'WANDER',zone,action:pick(actions[zone]||['Passeggia'],seed>>4)}
}

export function zoneState(agent,now=Date.now()){
 const life=agentLife(agent,now)
 return{...WORLD_ZONES[life.zone],...life}
}

export function clientState(issue,index=0){
 const stato=String(issue?.stato||'todo').toLowerCase()
 const urgency=String(issue?.urgenza||'media').toLowerCase()
 const bank=index%3
 const zone=stato==='waiting'?(bank===0?'waitingA':bank===1?'waitingB':'waitingC')
   :stato==='tecnico'?'service'
   :stato==='done'?'exit'
   :'reception'
 return{zone,urgency,...WORLD_ZONES[zone]}
}

export function issueIcon(issue){
 const text=((issue?.categoria||'')+' '+(issue?.note||'')).toLowerCase()
 if(/acqua|bagno|doccia|rubinet|perdita/.test(text))return'💧'
 if(/clima|aria|cald|fredd|condizion/.test(text))return'❄'
 if(/luce|lamp|elettr|presa|corrente/.test(text))return'⚡'
 if(/tv|wifi|rete|internet|telefono/.test(text))return'▣'
 if(/porta|serratura|chiave/.test(text))return'🔑'
 if(/ascensor/.test(text))return'↕'
 if(/puliz|biancher|camera/.test(text))return'✦'
 return'!'
}
