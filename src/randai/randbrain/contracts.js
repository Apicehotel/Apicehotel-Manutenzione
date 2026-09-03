export const BrainAutonomyLevel=Object.freeze({READ_ONLY:'READ_ONLY',SUGGEST:'SUGGEST',SAFE_EXECUTE:'SAFE_EXECUTE',APPROVAL_REQUIRED:'APPROVAL_REQUIRED'})
export const BrainDomain=Object.freeze({MAINTENANCE:'maintenance',KNOWLEDGE:'knowledge',WAREHOUSE:'warehouse',SOFTWARE:'software',ANALYSIS:'analysis',PROCEDURE:'procedure'})
export const BrainDecision=Object.freeze({READ:'READ',SUGGEST:'SUGGEST',EXECUTE:'EXECUTE',REQUEST_APPROVAL:'REQUEST_APPROVAL',STOP:'STOP'})
export function validateBrainRequest(x={}){
  if(!String(x.objective||'').trim())throw new TypeError('objective is required')
  if(!String(x.hotelId||'').trim())throw new TypeError('hotelId is required')
  if(x.context?.hotelId&&String(x.context.hotelId).trim()!==String(x.hotelId).trim())throw new Error(`RandBrain hotel scope mismatch: ${x.hotelId} != ${x.context.hotelId}`)
  if(x.autonomyLevel&&!Object.values(BrainAutonomyLevel).includes(x.autonomyLevel))throw new TypeError('invalid autonomyLevel')
  return true
}
export function assertEvidence(e=[]){if(!Array.isArray(e)||!e.length)throw new TypeError('RandBrain requires evidence');for(const x of e)if(!x?.source||!x?.verifiedAt||x.verified===false)throw new TypeError('Unverified evidence');return true}
