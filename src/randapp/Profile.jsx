import { useEffect, useState } from 'react'
import { changeOwnPin, getOwnNotificationCode, saveOwnNotificationCode, updateOwnProfile } from '../auth-data.js'
import { getPushSubscriptionState, getPushSupportInfo, subscribeToPush, unsubscribeFromPush } from '../push.js'
import { Button, Card, Field, Icon, TextInput, ThemeControl, UiSizeControl } from './ui.jsx'
import { hotelById, logoFor } from './helpers.js'
import { buildNotificationAlias, normalizeNotificationCode } from './notification-alias.js'
import NtfySetup from './ntfy/NtfySetup.jsx'

function Row({ label, value }) {
  return <div className="rs-profile-row"><span>{label}</span><b>{value || '—'}</b></div>
}

const PUSH_LABELS = {
  subscribed: 'Attive su questo dispositivo',
  'not-subscribed': 'Disattivate su questo dispositivo',
  denied: 'Bloccate nelle impostazioni del dispositivo',
  unsupported: 'Non disponibili su questo dispositivo',
  loading: 'Controllo in corso…',
}

export default function Profile({ user, hotel }) {
  const [email,setEmail]=useState(user?.email||'')
  const [phone,setPhone]=useState(user?.phone||'')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [currentPin,setCurrentPin]=useState('')
  const [newPin,setNewPin]=useState('')
  const [confirmPin,setConfirmPin]=useState('')
  const [pinBusy,setPinBusy]=useState(false)
  const [pinMessage,setPinMessage]=useState('')
  const [pinError,setPinError]=useState('')
  const [notificationCode,setNotificationCode]=useState('')
  const [savedNotificationCode,setSavedNotificationCode]=useState('')
  const [notificationBusy,setNotificationBusy]=useState(true)
  const [notificationMessage,setNotificationMessage]=useState('')
  const [notificationError,setNotificationError]=useState('')
  const [pushState,setPushState]=useState('loading')
  const [pushBusy,setPushBusy]=useState(false)
  const [pushMessage,setPushMessage]=useState('')
  const [pushError,setPushError]=useState('')
  const [pushInfo,setPushInfo]=useState(()=>getPushSupportInfo())

  useEffect(()=>{ setEmail(user?.email||''); setPhone(user?.phone||'') },[user])
  useEffect(()=>{
    let live=true
    setNotificationBusy(true); setNotificationError('')
    getOwnNotificationCode()
      .then((code)=>{ if(!live)return; setNotificationCode(code); setSavedNotificationCode(code) })
      .catch((err)=>{ if(live)setNotificationError(err?.message||'Codice notifiche non disponibile') })
      .finally(()=>{ if(live)setNotificationBusy(false) })
    return()=>{ live=false }
  },[user?.auth_user_id,user?.id])

  useEffect(()=>{
    let live=true
    setPushInfo(getPushSupportInfo())
    setPushState('loading')
    setPushMessage('')
    setPushError('')
    if(!hotel?.id){ setPushState('unsupported'); return()=>{ live=false } }
    getPushSubscriptionState(hotel.id)
      .then((state)=>{ if(live)setPushState(state) })
      .catch(()=>{ if(live)setPushState('not-subscribed') })
    return()=>{ live=false }
  },[hotel?.id,user?.auth_user_id,user?.id])

  const accessibleHotelNames = Array.from(new Set([hotel?.id, ...(user?.hotels || [])]))
    .filter(Boolean)
    .map((id) => hotelById(id)?.name)
    .filter(Boolean)
    .join(' · ')

  const save=async(e)=>{
    e.preventDefault(); setBusy(true); setMessage(''); setError('')
    try { await updateOwnProfile({email,phone}); setMessage('Profilo aggiornato correttamente.') }
    catch(err){ setError(err?.message||'Aggiornamento non riuscito') }
    finally { setBusy(false) }
  }

  const pinProps=(value,setter)=>({value,inputMode:'numeric',autoComplete:'off',onChange:e=>setter(e.target.value.replace(/\D/g,'').slice(0,4))})
  const savePin=async(e)=>{
    e.preventDefault(); setPinMessage(''); setPinError('')
    if(newPin.length!==4||newPin!==confirmPin){ setPinError('Il nuovo PIN deve essere di 4 cifre e coincidere.'); return }
    setPinBusy(true)
    try {
      await changeOwnPin({currentPin,newPin})
      setCurrentPin(''); setNewPin(''); setConfirmPin(''); setPinMessage('PIN aggiornato correttamente.')
    } catch(err){ setPinError(err?.message||'Cambio PIN non riuscito') }
    finally { setPinBusy(false) }
  }

  const saveNotificationCode=async(e)=>{
    e.preventDefault(); setNotificationMessage(''); setNotificationError('')
    if(savedNotificationCode){ setNotificationError('Il codice notifiche è definitivo e non può essere modificato.'); return }
    if(notificationCode.length!==6){ setNotificationError('Scegli esattamente 6 cifre.'); return }
    setNotificationBusy(true)
    try {
      const code=await saveOwnNotificationCode(notificationCode)
      setNotificationCode(code); setSavedNotificationCode(code)
      setNotificationMessage('Codice notifiche salvato definitivamente ✓')
    } catch(err){ setNotificationError(err?.message||'Salvataggio codice non riuscito') }
    finally { setNotificationBusy(false) }
  }

  const enablePush=async()=>{
    if(!hotel?.id)return
    setPushBusy(true); setPushMessage(''); setPushError('')
    try {
      await subscribeToPush(hotel.id)
      setPushInfo(getPushSupportInfo())
      setPushState(await getPushSubscriptionState(hotel.id))
      setPushMessage(`Notifiche push RandApp attivate su questo dispositivo per ${hotel.name}.`)
    } catch(err){
      setPushInfo(getPushSupportInfo())
      const state=await getPushSubscriptionState(hotel.id).catch(()=>null)
      if(state)setPushState(state)
      setPushError(err?.message||'Attivazione notifiche push non riuscita')
    } finally { setPushBusy(false) }
  }

  const disablePush=async()=>{
    if(!hotel?.id)return
    setPushBusy(true); setPushMessage(''); setPushError('')
    try {
      await unsubscribeFromPush(hotel.id)
      setPushState(await getPushSubscriptionState(hotel.id))
      setPushMessage(`Notifiche push RandApp disattivate su questo dispositivo per ${hotel.name}.`)
    } catch(err){ setPushError(err?.message||'Disattivazione notifiche push non riuscita') }
    finally { setPushBusy(false) }
  }

  const pushHint = pushInfo.requiresHomeScreen
    ? 'Su iPhone/iPad installa RandApp nella schermata Home e aprila da lì per usare le notifiche push.'
    : pushState==='denied'
      ? 'Il permesso è bloccato dal sistema. Riattiva le notifiche nelle impostazioni del browser o del dispositivo, poi torna qui.'
      : pushState==='subscribed'
        ? 'Ricevi gli avvisi RandApp direttamente da questo dispositivo. ntfy resta un canale separato.'
        : 'Attiva gli avvisi nativi RandApp su questo dispositivo. ntfy resta un canale separato.'

  return <div data-testid="profile-view">
    <div className="rs-page-title"><div><h1>Il mio profilo</h1><p>{hotel?.name}</p></div></div>

    <Card className="rs-card--pad rs-profile-head">
      <img src={logoFor(hotel?.id)} alt="" />
      <div><strong>{user?.name || 'Utente'}</strong><span className="rs-badge rs-badge--accent">{user?.role || '—'}</span></div>
    </Card>

    <section className="rs-section"><div className="rs-section__head"><h2>Dati account</h2></div><Card className="rs-card--pad"><Row label="Nome" value={user?.name} /><Row label="Ruolo" value={user?.role} /><Row label="Strutture abilitate" value={accessibleHotelNames} /></Card></section>

    <section className="rs-section"><div className="rs-section__head"><h2>Contatti</h2></div><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={save}><Field label="Email"><TextInput value={email} type="email" autoComplete="email" onChange={e=>setEmail(e.target.value)} /></Field><Field label="Telefono"><TextInput value={phone} inputMode="tel" autoComplete="tel" onChange={e=>setPhone(e.target.value)} /></Field><div className="rs-op-card__actions"><Button type="submit" disabled={busy}>Salva dati</Button></div>{message&&<p className="rs-success">{message}</p>}{error&&<p className="rs-error">{error}</p>}</form></Card></section>

    <section className="rs-section" data-testid="profile-pin"><div className="rs-section__head"><h2>Sicurezza</h2></div><Card className="rs-card--pad"><form className="rs-migrated-form" onSubmit={savePin}><Field label="PIN attuale"><TextInput icon="lock" {...pinProps(currentPin,setCurrentPin)} /></Field><Field label="Nuovo PIN"><TextInput icon="lock" {...pinProps(newPin,setNewPin)} /></Field><Field label="Ripeti nuovo PIN"><TextInput icon="lock" {...pinProps(confirmPin,setConfirmPin)} /></Field>{pinError&&<p className="rs-error">{pinError}</p>}{pinMessage&&<p className="rs-success">{pinMessage}</p>}<Button type="submit" disabled={pinBusy||currentPin.length!==4||newPin.length!==4||confirmPin.length!==4}>{pinBusy?'Salvo…':'Cambia PIN'}</Button></form></Card></section>

    <section className="rs-section" data-testid="profile-preferences"><div className="rs-section__head"><h2>Preferenze</h2></div><Card className="rs-card--pad rs-pref-block"><div className="rs-pref"><div className="rs-pref__label"><Icon name="sparkles" /><div><b>Tema</b><small>Sistema segue il tuo dispositivo</small></div></div><ThemeControl /></div><div className="rs-pref"><div className="rs-pref__label"><Icon name="sliders" /><div><b>Dimensione interfaccia</b><small>Più contenuto o più leggibilità</small></div></div><UiSizeControl /></div></Card></section>

    <section className="rs-section" data-testid="profile-push-notifications">
      <div className="rs-section__head"><h2>Notifiche push RandApp</h2><span className="rs-badge rs-badge--accent">{PUSH_LABELS[pushState]||PUSH_LABELS.loading}</span></div>
      <Card className="rs-card--pad">
        <div className="rs-pref">
          <div className="rs-pref__label"><Icon name="bell" /><div><b>Push su questo dispositivo</b><small>{pushHint}</small></div></div>
        </div>
        {pushError&&<p className="rs-error" role="alert">{pushError}</p>}
        {pushMessage&&<p className="rs-success" role="status">{pushMessage}</p>}
        <div className="rs-op-card__actions" style={{marginTop:12}}>
          {pushState==='subscribed'
            ? <Button type="button" variant="secondary" disabled={pushBusy} onClick={disablePush}>{pushBusy?'Disattivo…':'Disattiva notifiche push'}</Button>
            : <Button type="button" disabled={pushBusy||pushState==='loading'||pushState==='denied'||pushInfo.requiresHomeScreen||!pushInfo.supported} onClick={enablePush}>{pushBusy?'Attivo…':'Attiva notifiche push'}</Button>}
        </div>
      </Card>
    </section>

    <section className="rs-section" data-testid="notification-code">
      <div className="rs-section__head"><h2>Codice notifiche</h2>{savedNotificationCode&&<span className="rs-badge rs-badge--accent">Definitivo ✓</span>}</div>
      <Card className="rs-card--pad">
        {savedNotificationCode ? <>
          <p className="rs-ntfy-intro">Questo codice è stato assegnato definitivamente al tuo profilo e non può essere cambiato.</p>
          <Row label="Le tue 6 cifre" value={savedNotificationCode} />
          {hotel?.id&&<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{['urgent','reminders','assignments'].map((id)=><code key={id} className="rs-badge">{buildNotificationAlias(hotel.id,id,savedNotificationCode)}</code>)}</div>}
          <small>Formato: HOTEL-TIPO-CODICE · AV avvisi · PR promemoria · IP interventi personali.</small>
        </> : <form className="rs-migrated-form" onSubmit={saveNotificationCode}>
          <p className="rs-ntfy-intro">Scegli con attenzione 6 cifre personali: dopo il salvataggio saranno definitive e non potranno più essere cambiate.</p>
          <Field label="Le tue 6 cifre"><TextInput icon="bell" value={notificationCode} inputMode="numeric" autoComplete="off" placeholder="Es. 482710" onChange={e=>setNotificationCode(normalizeNotificationCode(e.target.value))} /></Field>
          {notificationCode.length===6&&hotel?.id&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{['urgent','reminders','assignments'].map((id)=><code key={id} className="rs-badge">{buildNotificationAlias(hotel.id,id,notificationCode)}</code>)}</div>}
          <small>Il codice è un identificativo, non il PIN. Una volta salvato viene bloccato.</small>
          {notificationError&&<p className="rs-error" role="alert">{notificationError}</p>}{notificationMessage&&<p className="rs-success" role="status">{notificationMessage}</p>}
          <Button type="submit" disabled={notificationBusy||notificationCode.length!==6}>{notificationBusy?'Salvo…':'Salva definitivamente'}</Button>
        </form>}
        {savedNotificationCode&&notificationError&&<p className="rs-error" role="alert">{notificationError}</p>}
      </Card>
    </section>

    <NtfySetup hotelId={hotel?.id} notificationCode={savedNotificationCode} />
  </div>
}
