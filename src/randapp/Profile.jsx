import { useEffect, useState } from 'react'
import { changeOwnPin, updateOwnProfile } from '../auth-data.js'
import { Button, Card, Field, Icon, TextInput, ThemeControl, UiSizeControl } from './ui.jsx'
import { logoFor } from './helpers.js'
import NtfySetup from './NtfySetup.jsx'

function Row({ label, value }) {
  return <div className="rs-profile-row"><span>{label}</span><b>{value || '—'}</b></div>
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

  useEffect(()=>{ setEmail(user?.email||''); setPhone(user?.phone||'') },[user])

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

  return <div data-testid="profile-view">
    <div className="rs-page-title"><div><h1>Il mio profilo</h1><p>{hotel?.name}</p></div></div>

    <Card className="rs-card--pad rs-profile-head">
      <img src={logoFor(hotel?.id)} alt="" />
      <div><strong>{user?.name || 'Utente'}</strong><span className="rs-badge rs-badge--accent">{user?.role || '—'}</span></div>
    </Card>

    <section className="rs-section">
      <div className="rs-section__head"><h2>Dati account</h2></div>
      <Card className="rs-card--pad">
        <Row label="Nome" value={user?.name} />
        <Row label="Ruolo" value={user?.role} />
        <Row label="Struttura attiva" value={hotel?.name} />
      </Card>
    </section>

    <section className="rs-section">
      <div className="rs-section__head"><h2>Contatti</h2></div>
      <Card className="rs-card--pad">
        <form className="rs-migrated-form" onSubmit={save}>
          <Field label="Email"><TextInput value={email} type="email" autoComplete="email" onChange={e=>setEmail(e.target.value)} /></Field>
          <Field label="Telefono"><TextInput value={phone} inputMode="tel" autoComplete="tel" onChange={e=>setPhone(e.target.value)} /></Field>
          <div className="rs-op-card__actions"><Button type="submit" disabled={busy}>Salva dati</Button></div>
          {message&&<p className="rs-success">{message}</p>}{error&&<p className="rs-error">{error}</p>}
        </form>
      </Card>
    </section>

    <section className="rs-section" data-testid="profile-pin">
      <div className="rs-section__head"><h2>Sicurezza</h2></div>
      <Card className="rs-card--pad">
        <form className="rs-migrated-form" onSubmit={savePin}>
          <Field label="PIN attuale"><TextInput icon="lock" {...pinProps(currentPin,setCurrentPin)} /></Field>
          <Field label="Nuovo PIN"><TextInput icon="lock" {...pinProps(newPin,setNewPin)} /></Field>
          <Field label="Ripeti nuovo PIN"><TextInput icon="lock" {...pinProps(confirmPin,setConfirmPin)} /></Field>
          {pinError&&<p className="rs-error">{pinError}</p>}{pinMessage&&<p className="rs-success">{pinMessage}</p>}
          <Button type="submit" disabled={pinBusy||currentPin.length!==4||newPin.length!==4||confirmPin.length!==4}>{pinBusy?'Salvo…':'Cambia PIN'}</Button>
        </form>
      </Card>
    </section>

    <section className="rs-section" data-testid="profile-preferences">
      <div className="rs-section__head"><h2>Preferenze</h2></div>
      <Card className="rs-card--pad rs-pref-block">
        <div className="rs-pref"><div className="rs-pref__label"><Icon name="sparkles" /><div><b>Tema</b><small>Sistema segue il tuo dispositivo</small></div></div><ThemeControl /></div>
        <div className="rs-pref"><div className="rs-pref__label"><Icon name="sliders" /><div><b>Dimensione interfaccia</b><small>Più contenuto o più leggibilità</small></div></div><UiSizeControl /></div>
      </Card>
    </section>

    <NtfySetup hotelId={hotel?.id} />
  </div>
}
