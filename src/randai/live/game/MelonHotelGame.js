import { Application, Renderable, Text, input } from 'melonjs'

const W=960,H=704,TILE=32
const COLORS={randai:'#56b7ff',randbrain:'#b981ff',randcore:'#ffad42',randmind:'#64d98b',randradar:'#ff5c62',randresearch:'#7fc8ff',randsecure:'#ff6464',randtest:'#e8d84b',randops:'#4fdbe8',randui:'#ff74d3'}
const HOMES={randai:[5,7],randbrain:[4,3],randcore:[15,8],randmind:[20,3],randradar:[26,18],randresearch:[25,3],randsecure:[21,8],randtest:[21,18],randops:[26,8],randui:[26,13]}
const ZONES={reception:[5,9],waiting:[16,15],service:[4,17],core:[15,8],brain:[4,3],cafe:[9,3],knowledge:[20,3],research:[25,3],secure:[21,8],ops:[26,8],design:[26,13],qa:[21,18],radar:[26,18],entrance:[15,20],exit:[27,20]}
const SOCIAL={randai:['reception','waiting','cafe','core'],randbrain:['brain','cafe','knowledge'],randcore:['core','reception','secure'],randmind:['knowledge','cafe','research'],randradar:['radar','entrance','research'],randresearch:['research','knowledge','cafe'],randsecure:['secure','entrance','core'],randtest:['qa','waiting','cafe'],randops:['ops','service','core'],randui:['design','waiting','qa']}

const key=(x,y)=>x+','+y
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)
function astar(blocked,start,goal,w,h){
 const open=[start], came=new Map(), g=new Map([[key(start.x,start.y),0]])
 const closed=new Set()
 while(open.length){
  open.sort((a,b)=>(g.get(key(a.x,a.y))+dist(a,goal))-(g.get(key(b.x,b.y))+dist(b,goal)))
  const cur=open.shift(), ck=key(cur.x,cur.y)
  if(cur.x===goal.x&&cur.y===goal.y){const out=[cur];let k=ck;while(came.has(k)){const p=came.get(k);out.push(p);k=key(p.x,p.y)}return out.reverse()}
  if(closed.has(ck))continue; closed.add(ck)
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=cur.x+dx,ny=cur.y+dy,nk=key(nx,ny)
   if(nx<1||ny<1||nx>=w-1||ny>=h-1||blocked.has(nk)||closed.has(nk))continue
   const ng=(g.get(ck)||0)+1
   if(ng<(g.get(nk)??Infinity)){g.set(nk,ng);came.set(nk,cur);open.push({x:nx,y:ny})}
  }
 }
 return[]
}

class HotelMap extends Renderable{
 constructor(map){super(0,0,W,H);this.anchorPoint.set(0,0);this.map=map}
 draw(r){
  r.setColor('#0b1d31');r.fillRect(0,0,W,H)
  r.setColor('#c49f6f');r.fillRect(32,32,W-64,H-64)
  r.setColor('#17334f');r.fillRect(32,32,W-64,140)
  r.setColor('#8f2548');r.fillRect(300,290,360,82)
  r.setColor('#d1b07b');r.fillRect(320,300,320,62)
  const zones=this.map.layers.find(l=>l.name==='zones')?.objects||[]
  for(const z of zones){
   const c={reception:'#2c6d96',waiting:'#315f85',service:'#4b6070',core:'#a66a24',brain:'#6b4290',cafe:'#8b6a35',knowledge:'#39845d',research:'#3f769b',secure:'#893641',ops:'#2f8188',design:'#974a80',qa:'#8b8538',radar:'#8f3b40'}[z.name]||'#596979'
   r.setColor(c);r.strokeRect(z.x+5,z.y+5,z.width-10,z.height-10)
  }
  r.setColor('#7a5734');r.fillRect(64,236,190,44);r.setColor('#e7b85d');r.fillRect(75,246,168,12)
  r.setColor('#264d79')
  for(const [x,y] of [[12,13],[15,13],[18,13],[21,13],[12,16],[15,16],[18,16],[21,16]])r.fillRect(x*TILE-22,y*TILE-12,44,24)
  r.setColor('#2e7d58')
  for(const [x,y] of [[45,180],[900,180],[275,430],[690,430],[55,615],[895,615]]){r.fillRect(x-7,y,14,20);r.fillRect(x-14,y-12,28,16)}
 }
}

class Agent extends Renderable{
 constructor(id,name,x,y,onClick){super(x*TILE,y*TILE,48,64);this.anchorPoint.set(.5,.5);this.id=id;this.name=name;this.path=[];this.speed=.11;this.t=0;this.status='IDLE';this.follow=false;this.onClick=onClick;input.registerPointerEvent('pointerdown',this,()=>{onClick(id);return false})}
 setPath(path){this.path=path.slice(1)}
 update(dt){
  this.t+=dt
  if(this.path.length){const p=this.path[0],tx=p.x*TILE+TILE/2,ty=p.y*TILE+TILE/2,dx=tx-this.pos.x,dy=ty-this.pos.y,d=Math.hypot(dx,dy);const step=Math.max(1,dt*this.speed);if(d<=step){this.pos.set(tx,ty);this.path.shift()}else{this.pos.x+=dx/d*step;this.pos.y+=dy/d*step}return true}return false
 }
 draw(r){
  const tone=COLORS[this.id]||'#7dd3fc'
  r.setColor('rgba(0,0,0,.25)');r.fillRect(this.pos.x-18,this.pos.y+22,36,7)
  if(this.follow){r.setColor(tone);r.strokeRect(this.pos.x-25,this.pos.y-34,50,68)}
  r.setColor('#ecf2f5');r.fillRect(this.pos.x-18,this.pos.y-28,36,24)
  r.setColor('#06101b');r.fillRect(this.pos.x-12,this.pos.y-21,24,10)
  r.setColor(tone);r.fillRect(this.pos.x-8,this.pos.y-18,4,4);r.fillRect(this.pos.x+4,this.pos.y-18,4,4)
  r.setColor(this.id==='randsecure'?'#32131a':this.id==='randops'?'#0b5670':this.id==='randui'?'#4d153e':'#dfe8ed');r.fillRect(this.pos.x-14,this.pos.y,28,24)
 }
 destroy(){input.releasePointerEvent('pointerdown',this);super.destroy?.()}
}

class Client extends Renderable{
 constructor(issue,x,y,onClick){super(x*TILE,y*TILE,34,50);this.anchorPoint.set(.5,.5);this.issue=issue;this.onClick=onClick;input.registerPointerEvent('pointerdown',this,()=>{onClick(issue.id);return false})}
 draw(r){const urgent=String(this.issue.urgenza||'').toLowerCase()==='alta';r.setColor('#dfe7ec');r.fillRect(this.pos.x-8,this.pos.y-22,16,16);r.setColor(urgent?'#6f2931':'#41566d');r.fillRect(this.pos.x-10,this.pos.y-4,20,24);if(urgent){r.setColor('#ff5667');r.fillRect(this.pos.x+10,this.pos.y-28,10,10)}}
 destroy(){input.releasePointerEvent('pointerdown',this);super.destroy?.()}
}

class Controller extends Renderable{
 constructor(engine){super(0,0,1,1);this.engine=engine;this.alwaysUpdate=true}
 update(){this.engine.tick();return false}
 draw(){}
}

export class RandMelonHotel{
 constructor(parent,{onAgent,onIssue}){this.parent=parent;this.onAgent=onAgent;this.onIssue=onIssue;this.app=null;this.map=null;this.blocked=new Set();this.agents=new Map();this.clients=new Map();this.runtime=[];this.issues=[];this.followId=null;this.lastWander=0}
 async init(){
  const res=await fetch('/randailive/maps/hotel-main.json',{cache:'no-store'});this.map=await res.json()
  const ground=this.map.layers.find(l=>l.name==='ground')
  ground.data.forEach((v,i)=>{if(v===2)this.blocked.add(key(i%this.map.width,Math.floor(i/this.map.width)))})
  this.app=new Application(W,H,{parent:this.parent,scale:1,scaleMethod:'fit',scaleTarget:this.parent,backgroundColor:'#081526'})
  await this.app.init()
  this.app.world.addChild(new HotelMap(this.map),0)
  for(const [id,name] of [['randai','RandAI'],['randbrain','RandBrain'],['randcore','RandCore'],['randmind','RandMind'],['randradar','RandRadar'],['randresearch','RandResearch'],['randsecure','RandSecure'],['randtest','RandTest'],['randops','RandOps'],['randui','RandUI']]){
   const [x,y]=HOMES[id];const a=new Agent(id,name,x+.5,y+.5,this.onAgent);this.agents.set(id,a);this.app.world.addChild(a,20)
  }
  this.app.world.addChild(new Controller(this),100)
  this.syncClients()
  this.applyFollow()
 }
 setRuntime(v){this.runtime=v||[]}
 setIssues(v){this.issues=v||[];if(this.app)this.syncClients()}
 setFollow(id){this.followId=id||null;if(this.app)this.applyFollow()}
 applyFollow(){
  if(!this.app?.viewport)return
  for(const [aid,a] of this.agents)a.follow=aid===this.followId
  if(this.followId){
   const a=this.agents.get(this.followId)
   if(a)this.app.viewport.follow(a,this.app.viewport.AXIS.BOTH,0.1)
  }else{
   this.app.viewport.unfollow()
  }
 }
 syncClients(){
  if(!this.app)return
  const ids=new Set(this.issues.map(i=>String(i.id)))
  for(const [id,c] of this.clients)if(!ids.has(id)){this.app.world.removeChild(c);c.destroy();this.clients.delete(id)}
  this.issues.forEach((issue,index)=>{const id=String(issue.id);let c=this.clients.get(id);if(!c){const zone=String(issue.stato)==='waiting'?'waiting':String(issue.stato)==='tecnico'?'service':'reception';const [x,y]=ZONES[zone];c=new Client(issue,x+(index%3),y+Math.floor(index/3)%2,this.onIssue);this.clients.set(id,c);this.app.world.addChild(c,15)}else c.issue=issue})
 }
 moveAgent(id,zone){
  const a=this.agents.get(id),target=ZONES[zone];if(!a||!target)return
  const sx=Math.floor(a.pos.x/TILE),sy=Math.floor(a.pos.y/TILE),goal={x:target[0],y:target[1]}
  const path=astar(this.blocked,{x:sx,y:sy},goal,this.map.width,this.map.height)
  if(path.length)a.setPath(path)
 }
 tick(){
  const now=Date.now();if(now-this.lastWander<4500)return;this.lastWander=now
  for(const a of this.agents.values()){
   const row=this.runtime.find(r=>r.id===a.id);a.status=row?.status||'IDLE'
   let zone
   if(a.status==='RUNNING')zone=Object.keys(HOMES).includes(a.id)?({randai:'reception',randbrain:'brain',randcore:'core',randmind:'knowledge',randradar:'radar',randresearch:'research',randsecure:'secure',randtest:'qa',randops:'ops',randui:'design'})[a.id]:'core'
   else if(a.status==='WAITING_APPROVAL')zone='reception'
   else if(a.status==='ERROR')zone=a.id==='randsecure'?'secure':'core'
   else{const list=SOCIAL[a.id]||['core'];zone=list[Math.floor(now/4500+a.id.length)%list.length]}
   if(!a.path.length)this.moveAgent(a.id,zone)
  }
 }
 destroy(){if(this.app){this.app.destroy();this.app=null}}
}
