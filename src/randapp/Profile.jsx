import { useEffect, useState } from 'react'
import { updateOwnProfile, setOwnPresence } from '../auth-data.js'
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

  useEffect(()=>{ setEmail(user?.email||''); setPhone(user?.phone||'') },[user])

  const save=async(e)=>{
    e.preventDefault(); setBusy(true); setMessage(''); setError('')
    try { await updateOwnProfile({email,phone}); setMessage('Profilo aggiornato correttamente.') }
    catch(err){ setError(err?.message||'Aggiornamento non riuscito') }
    finally { setBusy(false) }
  }
  const presence=async(value)=>{
    setBusy(true); setMessage(''); setError('')
    try { await setOwnPresence(value); setMessage(value?'Presenza in struttura attivata.':'Presenza disattivata.') }
    catch(err){ setError(err?.message||'Aggiornamento presenza non riuscito') }
    finally { setBusy(false) }
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
      <div className="rs-section__head"><h2>Contatti e presenza</h2></div>
      <Card className="rs-card--pad">
        <form className="rs-migrated-form" onSubmit={save}>
          <Field label="Email"><TextInput value={email} type="email" autoComplete="email" onChange={e=>setEmail(e.target.value)} /></Field>
          <Field label="Telefono"><TextInput value={phone} inputMode="tel" autoComplete="tel" onChange={e=>setPhone(e.target.value)} /></Field>
          <div className="rs-op-card__actions">
            <Button type="submit" disabled={busy}>Salva dati</Button>
            <Button type="button" variant="outline" onClick={()=>presence(true)} disabled={busy}>Sono in struttura</Button>
            <Button type="button" variant="ghost" onClick={()=>presence(false)} disabled={busy}>Fuori struttura</Button>
          </div>
          {message&&<p className="rs-success">{message}</p>}{error&&<p className="rs-error">{error}</p>}
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
