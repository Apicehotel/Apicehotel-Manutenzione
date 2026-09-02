import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { HOTELS } from '../../config.js'
import { changeRandAIPassword, createRandAIUser, isValidRandAIPassword, isValidRandAIUsername, listRandAIUsers, loginRandAI, signOutRandAI } from './randai-auth.js'
import './randai-auth.css'

const RandAIControlCenter=lazy(()=>import('../control/RandAIControlCenter.jsx'))
const ALL_HOTELS=HOTELS.map((hotel)=>hotel.id)

function Login({onReady}){
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const submit=async(event)=>{event.preventDefault();setError('');if(!isValidRandAIUsername(username)||!isValidRandAIPassword(password)){setError('Username non valido oppure password non alfanumerica da 6 a 12 caratteri.');return}setBusy(true);try{const user=await loginRandAI(username,password);onReady(user)}catch(e){setError(e?.message||'Accesso non riuscito')}finally{setBusy(false)}}
  return <div className="ra-gate"><form className="ra-login" onSubmit={submit}><img src="/icons/randai-cat.webp" alt=""/><small>AREA RISERVATA</small><h1>RandAI Control Center</h1><p>Accedi con le credenziali del ruolo RandAI.</p><label>Username<input autoCapitalize="none" autoCorrect="off" autoComplete="username" value={username} onChange={(e)=>setUsername(e.target.value)} maxLength={32}/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,12))} minLength={6} maxLength={12}/><span>6–12 caratteri alfanumerici.</span></label>{error&&<div className="ra-error">{error}</div>}<button className="ra-primary" disabled={busy}>{busy?'Accesso…':'Accedi a RandAI'}</button><button type="button" className="ra-link" onClick={()=>window.location.assign('/')}>← Torna a RandApp</button></form></div>
}

function AccessManager({open,onClose,currentUser}){
  const [users,setUsers]=useState([]),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const [name,setName]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[hotels,setHotels]=useState(ALL_HOTELS)
  const [newPassword,setNewPassword]=useState('')
  const load=useCallback(async()=>{setBusy(true);setNotice('');try{setUsers(await listRandAIUsers())}catch(e){setNotice(e?.message||'Caricamento utenti non riuscito')}finally{setBusy(false)}},[])
  useEffect(()=>{if(open)load()},[open,load])
  if(!open)return null
  const toggleHotel=(id)=>setHotels((prev)=>prev.includes(id)?prev.filter((x)=>x!==id):[...prev,id])
  const create=async(event)=>{event.preventDefault();setNotice('');if(!name.trim()||!isValidRandAIUsername(username)||!isValidRandAIPassword(password)||!hotels.length){setNotice('Completa nome, username, password valida e almeno una struttura.');return}setBusy(true);try{await createRandAIUser({name:name.trim(),username:username.trim(),password,hotels});setName('');setUsername('');setPassword('');setHotels(ALL_HOTELS);setNotice('Utente RandAI creato. La password iniziale è modificabile.');await load()}catch(e){setNotice(e?.message||'Creazione non riuscita')}finally{setBusy(false)}}
  const change=async(event)=>{event.preventDefault();setNotice('');if(!isValidRandAIPassword(newPassword)){setNotice('La nuova password deve essere alfanumerica da 6 a 12 caratteri.');return}setBusy(true);try{await changeRandAIPassword(newPassword);setNewPassword('');setNotice('Password aggiornata correttamente.')}catch(e){setNotice(e?.message||'Aggiornamento password non riuscito')}finally{setBusy(false)}}
  return <div className="ra-modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose()}}><section className="ra-modal"><header><div><small>ACCESSI RANDAI</small><h2>Utenti autorizzati</h2></div><button onClick={onClose} aria-label="Chiudi">×</button></header><div className="ra-columns"><div><h3>Nuovo utente</h3><form onSubmit={create} className="ra-form"><label>Nome<input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nome visualizzato"/></label><label>Username<input autoComplete="off" value={username} onChange={(e)=>setUsername(e.target.value.replace(/[^A-Za-z0-9._-]/g,'').slice(0,32))} placeholder="es. mario"/></label><label>Password iniziale<input type="password" autoComplete="new-password" value={password} onChange={(e)=>setPassword(e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,12))}/><span>6–12 caratteri alfanumerici. Non viene proposta alcuna password predefinita.</span></label><fieldset><legend>Strutture</legend>{HOTELS.map((hotel)=><label className="ra-check" key={hotel.id}><input type="checkbox" checked={hotels.includes(hotel.id)} onChange={()=>toggleHotel(hotel.id)}/>{hotel.name}</label>)}</fieldset><button className="ra-primary" disabled={busy}>Crea utente RandAI</button></form><h3>La mia password</h3><form onSubmit={change} className="ra-form"><label>Nuova password<input type="password" autoComplete="new-password" value={newPassword} onChange={(e)=>setNewPassword(e.target.value.replace(/[^A-Za-z0-9]/g,'').slice(0,12))} placeholder="6–12 caratteri"/></label><button disabled={busy||!newPassword}>Cambia password</button></form></div><div><h3>Utenti attivi</h3><div className="ra-users">{users.map((user)=><article key={user.id}><div><strong>{user.name}</strong><span>@{user.username}</span></div><small>{(user.hotels||[]).map((id)=>HOTELS.find((h)=>h.id===id)?.short||id).join(' · ')}</small>{user.must_change_password&&<em>Password iniziale</em>}</article>)}{!busy&&!users.length&&<p>Nessun utente RandAI disponibile.</p>}</div><div className="ra-current">Sessione: <strong>{currentUser?.name||'RandAI'}</strong></div></div></div>{notice&&<div className="ra-notice">{notice}</div>}</section></div>
}

export default function RandAIProtectedRoute(){
  const [state,setState]=useState({loading:true,allowed:false,user:null}),[manage,setManage]=useState(false)
  const check=useCallback(async()=>{if(!supabase){setState({loading:false,allowed:false,user:null});return}const {data}=await supabase.auth.getUser();const user=data?.user;if(!user){setState({loading:false,allowed:false,user:null});return}const {data:memberships}=await supabase.from('hotel_memberships').select('hotel_id,role,active,can_access_admin').eq('auth_user_id',user.id).eq('active',true).eq('role','RandAI').eq('can_access_admin',true);if(!memberships?.length){setState({loading:false,allowed:false,user:null});return}const {data:profile}=await supabase.from('profiles').select('display_name').eq('auth_user_id',user.id).maybeSingle();setState({loading:false,allowed:true,user:{id:user.id,name:profile?.display_name||'RandAI',hotels:memberships.map((x)=>x.hotel_id)}})},[])
  useEffect(()=>{check()},[check])
  const ready=()=>check()
  const logout=async()=>{await signOutRandAI();setState({loading:false,allowed:false,user:null})}
  if(state.loading)return <div className="ra-gate"><div className="ra-loading">Controllo credenziali RandAI…</div></div>
  if(!state.allowed)return <Login onReady={ready}/>
  return <><div className="ra-tools"><button onClick={()=>setManage(true)}>Accessi RandAI</button><button onClick={logout}>Esci</button></div><Suspense fallback={<div className="ra-gate"><div className="ra-loading">Caricamento Control Center…</div></div>}><RandAIControlCenter/></Suspense><AccessManager open={manage} onClose={()=>setManage(false)} currentUser={state.user}/></>
}
