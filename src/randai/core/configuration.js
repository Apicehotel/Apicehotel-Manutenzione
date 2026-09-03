const freeze=(value)=>Object.freeze(value)

export const RandConfigScope=freeze({ HOTEL:'HOTEL', GLOBAL:'GLOBAL' })

export const RAND_CONFIG_DEFINITIONS=freeze([
  freeze({section:'models',key:'primary_provider',label:'Provider primario',type:'text',defaultValue:'openai',scope:'HOTEL',secret:false}),
  freeze({section:'models',key:'primary_model',label:'Modello primario',type:'text',defaultValue:'',scope:'HOTEL',secret:false}),
  freeze({section:'models',key:'fallback_enabled',label:'Fallback provider',type:'boolean',defaultValue:true,scope:'HOTEL',secret:false}),
  freeze({section:'models',key:'fallback_model',label:'Modello fallback',type:'text',defaultValue:'',scope:'HOTEL',secret:false}),
  freeze({section:'budgets',key:'max_request_cost_usd',label:'Costo massimo per richiesta (USD)',type:'number',defaultValue:1,scope:'HOTEL',min:0,max:100,secret:false}),
  freeze({section:'budgets',key:'max_daily_cost_usd',label:'Budget giornaliero (USD)',type:'number',defaultValue:25,scope:'HOTEL',min:0,max:10000,secret:false}),
  freeze({section:'autonomy',key:'default_mode',label:'Autonomia predefinita',type:'enum',values:['REVIEW','BLOCK','AUTO_LOW_RISK'],defaultValue:'REVIEW',scope:'HOTEL',secret:false}),
  freeze({section:'knowledge',key:'approved_only',label:'Usa solo conoscenza approvata',type:'boolean',defaultValue:true,scope:'HOTEL',locked:true,secret:false}),
  freeze({section:'memory',key:'verified_learning_only',label:'Apprendimento solo verificato',type:'boolean',defaultValue:true,scope:'HOTEL',locked:true,secret:false}),
  freeze({section:'actions',key:'require_confirmation_high_risk',label:'Conferma azioni ad alto rischio',type:'boolean',defaultValue:true,scope:'GLOBAL',locked:true,secret:false}),
  freeze({section:'recovery',key:'enabled',label:'Recovery controllato',type:'boolean',defaultValue:true,scope:'HOTEL',secret:false}),
  freeze({section:'evals',key:'release_gate_required',label:'Evaluation gate obbligatorio',type:'boolean',defaultValue:true,scope:'GLOBAL',locked:true,secret:false}),
])

export function getRandConfigDefinition(section,key){
  return RAND_CONFIG_DEFINITIONS.find((item)=>item.section===section&&item.key===key)||null
}

export function validateRandConfigValue(definition,value){
  if(!definition) return {ok:false,error:'UNKNOWN_CONFIG_KEY'}
  if(definition.secret) return {ok:false,error:'SECRETS_NOT_ALLOWED'}
  if(definition.type==='boolean'&&typeof value!=='boolean') return {ok:false,error:'EXPECTED_BOOLEAN'}
  if(definition.type==='number'){
    if(typeof value!=='number'||!Number.isFinite(value)) return {ok:false,error:'EXPECTED_NUMBER'}
    if(definition.min!=null&&value<definition.min) return {ok:false,error:'VALUE_TOO_LOW'}
    if(definition.max!=null&&value>definition.max) return {ok:false,error:'VALUE_TOO_HIGH'}
  }
  if(definition.type==='text'&&typeof value!=='string') return {ok:false,error:'EXPECTED_TEXT'}
  if(definition.type==='enum'&&!definition.values.includes(value)) return {ok:false,error:'INVALID_ENUM_VALUE'}
  return {ok:true,value}
}

export function buildEffectiveRandConfig(rows=[],hotelId=null){
  const scoped=rows.filter((row)=>row.enabled!==false&&(row.hotel_id==null||row.hotel_id===hotelId))
  const values={}
  for(const definition of RAND_CONFIG_DEFINITIONS){
    const globalRow=scoped.find((row)=>row.hotel_id==null&&row.section===definition.section&&row.key===definition.key)
    const hotelRow=scoped.find((row)=>row.hotel_id===hotelId&&row.section===definition.section&&row.key===definition.key)
    const row=hotelRow||globalRow
    values[`${definition.section}.${definition.key}`]={...definition,value:row?.value??definition.defaultValue,version:row?.version??0,source:hotelRow?'HOTEL':globalRow?'GLOBAL':'DEFAULT'}
  }
  return values
}
