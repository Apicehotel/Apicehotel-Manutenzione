import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../supabase.js'
import { RAND_CONFIG_DEFINITIONS, buildEffectiveRandConfig, validateRandConfigValue } from '../core/configuration.js'

const HOTEL={hotelgio:'Hotel Giò',chocohotel:'Chocohotel',brigantino:'Il Brigantino'}
const SECTION={models:'Modelli & routing',budgets:'Budget',autonomy:'Autonomia',knowledge:'Conoscenza',memory:'Memoria',actions:'Azioni',recovery:'Recovery',evals:'Evaluation'}

function parseInput(def,raw){
  if(def.type==='boolean') return raw==='true'
  if(def.type==='number') return Number(raw)
  return raw
}

export default function RandAIConfigurationConsole({accessHotels=[],hotelFilter='all'}){
  const [rows,setRows]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const activeHotel=hotelFilter==='all'?(accessHotels[0]||null):hotelFilter
  const load=useCallback(async()=>{
    if(!supabase||!accessHotels.length)return
    setBusy(true);setNotice('')
    const {data,error}=await supabase.from('randai_runtime_config').select('id,hotel_id,section,key,value,enabled,version,updated_at').or(`hotel_id.is.null,hotel_id.in.(${accessHotels.join(',')})`).order('section').order('key')
    if(error)setNotice(error.message||'Configurazione non disponibile. Applica la migration del Blocco 13.')
    else setRows(data||[])
    setBusy(false)
  },[accessHotels.join('|')])
  useEffect(()=>{load()},[load])

  const effective=useMemo(()=>buildEffectiveRandConfig(rows,activeHotel),[rows,activeHotel])
  const grouped=useMemo(()=>Object.groupBy?Object.groupBy(RAND_CONFIG_DEFINITIONS,(d)=>d.section):RAND_CONFIG_DEFINITIONS.reduce((a,d)=>((a[d.section]??=[]).push(d),a),{}),[])

  const save=async(def,raw)=>{
    if(!activeHotel&&def.scope!=='GLOBAL'){setNotice('Seleziona una struttura prima di modificare questa voce.');return}
    const value=parseInput(def,raw)
    const checked=validateRandConfigValue(def,value)
    if(!checked.ok){setNotice(`Valore non valido: ${checked.error}`);return}
    if(def.locked){setNotice('Questa protezione è bloccata dal contratto RandCore e non è modificabile dalla UI.');return}
    const scopeHotel=def.scope==='GLOBAL'?null:activeHotel
    const current=rows.find((row)=>row.hotel_id===scopeHotel&&row.section===def.section&&row.key===def.key)
    setBusy(true);setNotice('')
    const {error}=await supabase.rpc('randai_set_runtime_config',{p_hotel_id:scopeHotel,p_section:def.section,p_key:def.key,p_value:value,p_expected_version:current?.version||0})
    if(error)setNotice(error.message||'Salvataggio non riuscito.')
    else{setNotice(`Configurazione aggiornata${scopeHotel?` per ${HOTEL[scopeHotel]||scopeHotel}`:' globalmente'}.`);await load()}
    setBusy(false)
  }

  return <div className="rc-config"><section className="rc-panel"><header><strong>RandAI Configuration 360°</strong><span>{activeHotel?HOTEL[activeHotel]||activeHotel:'nessun hotel selezionato'}</span></header><div className="rc-panel-body"><p>Qui si configurano solo valori operativi non segreti. API key, service role, token e credenziali non vengono mai salvati in questa tabella. Le modifiche usano RPC autorizzata, optimistic version fence e storico revisioni.</p>{hotelFilter==='all'&&accessHotels.length>1&&<div className="rc-notice">Vista “tutte le strutture”: le impostazioni hotel-specifiche mostrate usano {HOTEL[activeHotel]}. Seleziona un hotel dalla barra superiore prima di modificarle.</div>}{notice&&<div className="rc-notice">{notice}</div>}<div className="rc-config-sections">{Object.entries(grouped).map(([section,defs])=><section className="rc-config-group" key={section}><header><h3>{SECTION[section]||section}</h3><span>{defs.length} controlli</span></header>{defs.map((def)=>{const current=effective[`${def.section}.${def.key}`];const display=current?.value??def.defaultValue;return <label className={`rc-config-row ${def.locked?'is-locked':''}`} key={`${def.section}.${def.key}`}><span><strong>{def.label}</strong><small>{def.scope==='GLOBAL'?'Globale esplicito':'Per hotel'} · sorgente {current?.source||'DEFAULT'} · v{current?.version||0}{def.locked?' · protezione bloccata':''}</small></span>{def.type==='boolean'?<select value={String(display)} disabled={busy||def.locked} onChange={(e)=>save(def,e.target.value)}><option value="true">Attivo</option><option value="false">Disattivo</option></select>:def.type==='enum'?<select value={display} disabled={busy||def.locked} onChange={(e)=>save(def,e.target.value)}>{def.values.map((v)=><option key={v}>{v}</option>)}</select>:<input type={def.type==='number'?'number':'text'} value={display} min={def.min} max={def.max} disabled={busy||def.locked} onChange={(e)=>{const value=e.target.value;e.currentTarget.dataset.pending=value}} onBlur={(e)=>{if(String(display)!==e.target.value)save(def,e.target.value)}}/>}</label>})}</section>)}</div></div></section></div>
}
