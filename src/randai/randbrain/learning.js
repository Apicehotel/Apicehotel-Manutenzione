export class RandBrainLearningAdapter{
  constructor({learningEngine}={}){if(!learningEngine||typeof learningEngine.observe!=='function')throw new TypeError('learningEngine.observe is required');this.learningEngine=learningEngine}
  async observeVerifiedOutcome({hotelId,problemClass,strategy,outcome,source,tools=[],successCriteria=[],recovery=null,runId=null}={}){
    if(!String(hotelId||'').trim())throw new TypeError('hotelId is required')
    if(!source?.id&&!runId)throw new TypeError('source.id or runId is required')
    const experience={hotelId,problemClass,strategy,tools,successCriteria,verified:true,source:source||{kind:'randbrain-run',id:runId},metadata:{hotelId,runId,outcome,recovery}}
    return this.learningEngine.observe(experience)
  }
}
