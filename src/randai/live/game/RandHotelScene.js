import * as Phaser from 'phaser'
import { GridEngine, PathBlockedStrategy } from 'grid-engine'
import { HotelAgentBrain } from './agent-brain.js'

const GAME_W=960
const GAME_H=704
const TILE=32

const AGENTS=Object.freeze([
  ['randai','RandAI',0x56b7ff,'AI'],
  ['randbrain','RandBrain',0xb981ff,'B'],
  ['randcore','RandCore',0xffad42,'C'],
  ['randmind','RandMind',0x64d98b,'M'],
  ['randradar','RandRadar',0xff5c62,'R'],
  ['randresearch','RandResearch',0x7fc8ff,'?'],
  ['randsecure','RandSecure',0xff6464,'S'],
  ['randtest','RandTest',0xe8d84b,'✓'],
  ['randops','RandOps',0x4fdbe8,'O'],
  ['randui','RandUI',0xff74d3,'UI'],
])

const STARTS=Object.freeze({
  randai:{x:5,y:6}, randbrain:{x:4,y:3}, randcore:{x:14,y:8}, randmind:{x:20,y:3},
  randradar:{x:26,y:18}, randresearch:{x:25,y:3}, randsecure:{x:21,y:8},
  randtest:{x:21,y:18}, randops:{x:26,y:8}, randui:{x:26,y:12},
})

const CLIENT_SLOTS=Object.freeze({
  reception:[{x:3,y:9},{x:5,y:9},{x:7,y:9},{x:3,y:11},{x:5,y:11},{x:7,y:11}],
  waiting:[{x:12,y:13},{x:15,y:13},{x:18,y:13},{x:21,y:13},{x:12,y:16},{x:15,y:16},{x:18,y:16},{x:21,y:16}],
  service:[{x:3,y:16},{x:5,y:16},{x:3,y:18},{x:5,y:18}],
  entrance:[{x:14,y:19},{x:15,y:19},{x:16,y:19}],
  exit:[{x:26,y:19},{x:27,y:19}],
})

const statusZone=(issue)=>{
  const s=String(issue?.stato||'todo').toLowerCase()
  if(s==='waiting')return'waiting'
  if(s==='tecnico')return'service'
  if(s==='done')return'exit'
  return'reception'
}

const hash=(value)=>{
  let h=2166136261
  const text=String(value||'')
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return h>>>0
}

class RandHotelScene extends Phaser.Scene{
  constructor(){
    super('RandHotelScene')
    this.brains=new Map()
    this.agentContainers=new Map()
    this.clientContainers=new Map()
    this.zones=new Map()
    this.lastRuntimeSignature=''
    this.lastIssueSignature=''
  }

  preload(){
    this.load.image('hotel-tiles','/randailive/tiles/hotel-tiles.svg')
    this.load.tilemapTiledJSON('hotel-map','/randailive/maps/hotel-main.json')
  }

  create(){
    const map=this.make.tilemap({key:'hotel-map'})
    const tiles=map.addTilesetImage('hotel-tiles','hotel-tiles')
    const ground=map.createLayer('ground',tiles,0,0)
    ground.setCollisionByProperty({ge_collide:true})
    this.drawEnvironment(map)

    const characters=AGENTS.map(([id,name,tone,glyph])=>{
      const container=this.createAgentContainer(id,name,tone,glyph)
      this.agentContainers.set(id,container)
      container.setInteractive(new Phaser.Geom.Rectangle(-28,-42,56,78),Phaser.Geom.Rectangle.Contains)
      container.on('pointerdown',()=>this.game.events.emit('randailive:agent',id))
      return{id,container,startPosition:STARTS[id],speed:2.4,collides:true}
    })

    this.gridEngine.create(map,{
      characters,
      collisionTilePropertyName:'ge_collide',
      cacheTileCollisions:true,
    })

    for(const [id] of AGENTS)this.brains.set(id,new HotelAgentBrain(this,id))
    this.registry.events.on('changedata-randRuntime',this.syncRuntime,this)
    this.registry.events.on('changedata-randIssues',this.syncIssues,this)
    this.syncRuntime()
    this.syncIssues()

    this.scale.on('resize',()=>this.cameras.main.centerOn(GAME_W/2,GAME_H/2))
    this.cameras.main.setBackgroundColor('#081526')
    this.cameras.main.centerOn(GAME_W/2,GAME_H/2)
  }

  shutdown(){
    this.registry.events.off('changedata-randRuntime',this.syncRuntime,this)
    this.registry.events.off('changedata-randIssues',this.syncIssues,this)
  }

  update(){
    for(const brain of this.brains.values())brain.update()
  }

  drawEnvironment(map){
    const g=this.add.graphics()
    g.setDepth(1)
    const zones=map.getObjectLayer('zones')?.objects||[]
    for(const zone of zones){
      const cx=zone.x+zone.width/2, cy=zone.y+zone.height/2
      this.zones.set(zone.name,{x:Math.floor(cx/TILE),y:Math.floor(cy/TILE)})
    }

    // Large waiting room: visualized from Tiled coordinates.
    const waiting=zones.find(z=>z.name==='waiting')
    if(waiting){
      g.fillStyle(0xc6a578,1).fillRect(waiting.x+4,waiting.y+4,waiting.width-8,waiting.height-8)
      g.lineStyle(4,0x315f85,1).strokeRect(waiting.x+2,waiting.y+2,waiting.width-4,waiting.height-4)
      for(let row=0;row<2;row++)for(let col=0;col<4;col++){
        const x=waiting.x+45+col*85,y=waiting.y+70+row*92
        g.fillStyle(0x264d79,1).fillRoundedRect(x,y,58,24,5)
        g.fillStyle(0x19395c,1).fillRect(x+4,y+18,50,8)
      }
      const title=this.add.text(waiting.x+waiting.width/2,waiting.y+22,'SALA ATTESA',{fontFamily:'monospace',fontSize:'17px',fontStyle:'bold',color:'#eaf7ff'}).setOrigin(.5)
      title.setDepth(3)
    }

    const labels={
      reception:['RECEPTION',0x56b7ff],service:['SERVICE',0x79c7ff],core:['RandCore HUB',0xffad42],
      brain:['RandBrain',0xb981ff],cafe:['COFFEE',0xd5a353],knowledge:['RandMind',0x64d98b],
      research:['RandResearch',0x7fc8ff],secure:['RandSecure',0xff6464],ops:['RandOps',0x4fdbe8],
      design:['RandUI',0xff74d3],qa:['RandTest',0xe8d84b],radar:['RandRadar',0xff5c62],
      elevators:['ELEVATORS',0xd9b76e],entrance:['INGRESSO',0xd0aa65],exit:['USCITA',0xd0aa65],
    }
    for(const zone of zones){
      const meta=labels[zone.name]
      if(!meta)continue
      g.lineStyle(2,meta[1],.85).strokeRect(zone.x+4,zone.y+4,zone.width-8,zone.height-8)
      this.add.text(zone.x+zone.width/2,zone.y+10,meta[0],{fontFamily:'monospace',fontSize:'11px',fontStyle:'bold',color:'#dff4ff'}).setOrigin(.5,0).setDepth(3)
    }
  }

  createAgentContainer(id,name,tone,glyph){
    const body=this.add.container(0,0)
    const shadow=this.add.ellipse(0,24,38,10,0x000000,.28)
    const torso=this.add.rectangle(0,4,32,28,0xdfe8ed).setStrokeStyle(4,0x08131f)
    const head=this.add.rectangle(0,-22,42,30,0xecf2f5).setStrokeStyle(4,0x08131f)
    const visor=this.add.rectangle(0,-22,28,11,0x06101b)
    const eye1=this.add.rectangle(-7,-22,4,4,tone)
    const eye2=this.add.rectangle(7,-22,4,4,tone)
    const mark=this.add.text(0,4,glyph,{fontFamily:'monospace',fontSize:glyph.length>1?'8px':'12px',fontStyle:'bold',color:'#0b1622'}).setOrigin(.5)
    const tag=this.add.text(0,31,name,{fontFamily:'monospace',fontSize:'9px',fontStyle:'bold',color:'#ffffff',backgroundColor:'#07101ddd',padding:{x:3,y:2}}).setOrigin(.5,0)
    body.add([shadow,torso,head,visor,eye1,eye2,mark,tag])
    body.setSize(56,78)
    body.setDepth(20)

    if(id==='randbrain'){
      body.add(this.add.ellipse(0,-38,28,14,0xff8df1).setStrokeStyle(3,0x38144a))
    }else if(id==='randmind'){
      head.setFillStyle(0x1d6b42)
    }else if(id==='randsecure'){
      head.setFillStyle(0x32131a)
      body.add(this.add.triangle(20,2,0,-12,12,0,0,12,0xff6464).setStrokeStyle(2,0x551018))
    }else if(id==='randradar'){
      head.setFillStyle(0x74202a)
      body.add(this.add.circle(21,-30,7,0x133d33).setStrokeStyle(2,0xff5c62))
    }else if(id==='randops'){
      head.setFillStyle(0x0b5670)
    }else if(id==='randui'){
      head.setFillStyle(0x4d153e)
    }
    return body
  }

  createClientContainer(issue,index){
    const urgent=String(issue.urgenza||'').toLowerCase()==='alta'
    const c=this.add.container(0,0)
    const shadow=this.add.ellipse(0,18,24,7,0x000000,.22)
    const head=this.add.circle(0,-12,10,0xdfe7ec).setStrokeStyle(3,0x0b1622)
    const body=this.add.rectangle(0,8,24,26,urgent?0x6f2931:0x41566d).setStrokeStyle(3,0x0b1622)
    const badge=this.add.text(15,-25,urgent?'!':String(issue.urgenza||'').toLowerCase()==='media'?'?':'·',{fontFamily:'monospace',fontSize:'12px',fontStyle:'bold',color:'#fff',backgroundColor:urgent?'#7b1723':'#17344d',padding:{x:4,y:1}}).setOrigin(.5)
    c.add([shadow,body,head,badge])
    c.setSize(42,58).setDepth(15).setInteractive(new Phaser.Geom.Rectangle(-22,-28,44,58),Phaser.Geom.Rectangle.Contains)
    c.on('pointerdown',()=>this.game.events.emit('randailive:issue',issue.id))
    c.setData('issue',issue)
    return c
  }

  syncRuntime(){
    const runtime=this.registry.get('randRuntime')||[]
    const signature=runtime.map(a=>a.id+':'+a.status+':'+(a.taskId||'')).join('|')
    if(signature===this.lastRuntimeSignature)return
    this.lastRuntimeSignature=signature
    for(const agent of runtime){
      const brain=this.brains.get(agent.id)
      if(brain)brain.sync(agent.status)
      const c=this.agentContainers.get(agent.id)
      if(c)c.setAlpha(agent.status==='OFFLINE'?.55:1)
    }
  }

  syncIssues(){
    const issues=this.registry.get('randIssues')||[]
    const signature=issues.map(i=>i.id+':'+i.stato+':'+i.urgenza).join('|')
    if(signature===this.lastIssueSignature)return
    this.lastIssueSignature=signature
    const current=new Set(issues.map(i=>String(i.id)))
    for(const [id,c] of this.clientContainers){
      if(!current.has(id)){c.destroy(true);this.clientContainers.delete(id)}
    }
    issues.forEach((issue,index)=>{
      const id=String(issue.id)
      let c=this.clientContainers.get(id)
      if(!c){
        c=this.createClientContainer(issue,index)
        this.clientContainers.set(id,c)
        const entry=CLIENT_SLOTS.entrance[index%CLIENT_SLOTS.entrance.length]
        c.setPosition(entry.x*TILE+TILE/2,entry.y*TILE+TILE/2)
      }
      c.setData('issue',issue)
      const zone=statusZone(issue)
      const slots=CLIENT_SLOTS[zone]||CLIENT_SLOTS.reception
      const slot=slots[hash(id)%slots.length]
      this.tweens.add({targets:c,x:slot.x*TILE+TILE/2,y:slot.y*TILE+TILE/2,duration:700,ease:'Sine.easeInOut'})
    })
  }

  moveAgentToZone(id,zone){
    const target=this.zones.get(zone)
    if(!target)return
    try{
      this.gridEngine.moveTo(id,target,{
        pathBlockedStrategy:PathBlockedStrategy.RETRY,
        pathBlockedMaxRetries:2,
        pathBlockedRetryBackoffMs:250,
      })
    }catch{
      // The visual world must never break RandApp if a path becomes unavailable.
    }
  }

  isMoving(id){
    try{return this.gridEngine.isMoving(id)}catch{return false}
  }
}

export function createRandHotelGame(parent){
  return new Phaser.Game({
    type:Phaser.AUTO,
    parent,
    width:GAME_W,
    height:GAME_H,
    backgroundColor:'#081526',
    pixelArt:true,
    render:{antialias:false,roundPixels:true},
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:GAME_W,height:GAME_H},
    input:{touch:{capture:false},mouse:{preventDefaultWheel:false}},
    plugins:{scene:[{key:'gridEngine',plugin:GridEngine,mapping:'gridEngine'}]},
    scene:[RandHotelScene],
  })
}
