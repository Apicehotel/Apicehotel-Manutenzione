import { State, StateMachine } from 'yuka'

const HOME = Object.freeze({
  randai:'reception', randbrain:'brain', randcore:'core', randmind:'knowledge',
  randradar:'radar', randresearch:'research', randsecure:'secure',
  randtest:'qa', randops:'ops', randui:'design',
})

const WANDER = Object.freeze({
  randai:['reception','waiting','cafe','core'],
  randbrain:['brain','cafe','knowledge','core'],
  randcore:['core','reception','secure','ops'],
  randmind:['knowledge','cafe','research','waiting'],
  randradar:['radar','entrance','research','cafe'],
  randresearch:['research','knowledge','cafe','waiting'],
  randsecure:['secure','entrance','core','waiting'],
  randtest:['qa','ops','waiting','cafe'],
  randops:['ops','service','core','cafe'],
  randui:['design','waiting','qa','cafe'],
})

function hash(text){
  let h=2166136261
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}

class HotelState extends State{
  constructor(mode,target){super();this.mode=mode;this.target=target}
  enter(owner){owner.mode=this.mode;owner.nextMoveAt=0}
  execute(owner){
    if(owner.scene.isMoving(owner.id))return
    const now=Date.now()
    if(now<owner.nextMoveAt)return
    const zone=typeof this.target==='function'?this.target(owner,now):this.target
    if(zone)owner.scene.moveAgentToZone(owner.id,zone)
    owner.nextMoveAt=now+(this.mode==='WANDER'?6500:4000)
  }
}

const wanderTarget=(owner,now)=>{
  const list=WANDER[owner.id]||['core']
  const slot=Math.floor(now/6500)
  return list[hash(owner.id+':'+slot)%list.length]
}

export class HotelAgentBrain{
  constructor(scene,id){
    this.owner={scene,id,mode:'WANDER',nextMoveAt:0}
    this.machine=new StateMachine(this.owner)
    this.machine.add('WANDER',new HotelState('WANDER',wanderTarget))
    this.machine.add('WORK',new HotelState('WORK',HOME[id]||'core'))
    this.machine.add('WAIT',new HotelState('WAIT','reception'))
    this.machine.add('ALERT',new HotelState('ALERT',id==='randsecure'?'secure':'core'))
    this.machine.changeTo('WANDER')
    this.lastStatus=null
  }

  sync(status){
    if(status===this.lastStatus)return
    this.lastStatus=status
    if(status==='RUNNING')this.machine.changeTo('WORK')
    else if(status==='WAITING_APPROVAL')this.machine.changeTo('WAIT')
    else if(status==='ERROR')this.machine.changeTo('ALERT')
    else this.machine.changeTo('WANDER')
  }

  update(){
    this.machine.update()
  }
}
