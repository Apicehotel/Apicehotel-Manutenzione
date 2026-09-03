export class RandBrainFailureIntelligence{
  #items=new Map()
  record({fingerprint,hotelId,outcome,verified=false,recovery=null}={}){if(!fingerprint||!hotelId)throw new TypeError('fingerprint and hotelId are required');if(!verified)throw new Error('Only verified outcomes can train RandBrain');const key=`${hotelId}::${fingerprint}`;const prev=this.#items.get(key)||{count:0,successes:0,failures:0};const next={...prev,count:prev.count+1,successes:prev.successes+(outcome==='SUCCEEDED'?1:0),failures:prev.failures+(outcome==='SUCCEEDED'?0:1),lastOutcome:outcome,recovery,lastVerifiedAt:new Date().toISOString()};this.#items.set(key,next);return structuredClone(next)}
  get({fingerprint,hotelId}={}){const value=this.#items.get(`${hotelId}::${fingerprint}`);return value?structuredClone(value):null}
  recommendation({fingerprint,hotelId}={}){const x=this.get({fingerprint,hotelId});if(!x)return {action:'NO_HISTORY'};if(x.failures>=3&&x.failures>x.successes)return {action:'ESCALATE',reason:'REPEATED_VERIFIED_FAILURE'};if(x.recovery&&x.successes>0)return {action:'PREFER_RECOVERY',recovery:x.recovery};return {action:'NORMAL'}}
}
