import { useMemo, useState } from 'react'
import { Button, Card } from '../ui.jsx'
import { parseNotificationAlias } from '../notification-alias.js'
import { friendlyNtfyError, resolveNtfyShortLink } from './ntfy-client.js'
import { supabase } from '../../supabase.js'

export default function NtfyShortLink({ alias }) {
  const parsed=useMemo(()=>parseNotificationAlias(alias),[alias])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [manual,setManual]=useState('')

  const goLogin=()=>{
    if(!parsed) return
    window.location.replace(`/?ntfy_short=${encodeURIComponent(parsed.alias)}`)
  }

  const resolve=async(mode='open')=>{
    if(!parsed) return
    setBusy(true); setError(''); setManual('')
    try{
      const {data}=await supabase.auth.getSession()
      if(!data?.session){ goLogin(); return }
      const result=await resolveNtfyShortLink(parsed.alias)
      if(mode==='copy'){
        await navigator.clipboard.writeText(result.topic)
        setManual('Topic ntfy copiato ✓ Incollalo nel campo Topic di ntfy.')
        return
      }
      // Safari on iOS rejects the ntfy:// custom scheme in this flow.
      // Open the verified HTTPS ntfy topic instead: if the app is associated it
      // can take over, otherwise the ntfy web page remains a valid fallback.
      const target=result.web_link || `${result.server || 'https://ntfy.sh'}/${encodeURIComponent(result.topic)}`
      window.location.assign(target)
    }catch(err){ setError(friendlyNtfyError(err)) }
    finally{ setBusy(false) }
  }

  if(!parsed) return <main className="rs-page" style={{maxWidth:560,margin:'0 auto',paddingTop:32}}><Card className="rs-card--pad"><h1>Link non valido</h1><p>Questo collegamento notifiche RandApp non è riconosciuto.</p><Button type="button" onClick={()=>window.location.replace('/')}>Apri RandApp</Button></Card></main>

  return <main className="rs-page" style={{maxWidth:560,margin:'0 auto',paddingTop:32}} data-testid="ntfy-short-link">
    <Card className="rs-card--pad">
      <div className="rs-section__head"><h1>Canale notifiche</h1><span className="rs-badge rs-badge--accent">Protetto</span></div>
      <p>Stai aprendo il link breve personale:</p>
      <code style={{display:'block',fontSize:'1.1em',margin:'12px 0'}}>{parsed.alias}</code>
      <p>RandApp verifica identità, proprietario del codice e accesso alla struttura. Poi apre il canale ntfy corretto senza usare il link RandApp come topic.</p>
      <div className="rs-op-card__actions"><Button type="button" onClick={()=>resolve('open')} disabled={busy}>{busy?'Verifico…':'Apri canale ntfy'}</Button><Button type="button" variant="outline" onClick={goLogin}>Apri RandApp</Button></div>
      <details style={{marginTop:14}}><summary>Configurazione manuale</summary><p><small>Per aggiungere manualmente la sottoscrizione nell’app ntfy, copia il topic verificato qui sotto.</small></p><Button type="button" variant="outline" onClick={()=>resolve('copy')} disabled={busy}>Copia topic ntfy</Button></details>
      {manual&&<p className="rs-success" role="status">{manual}</p>}{error&&<p className="rs-error" role="alert">{error}</p>}
    </Card>
  </main>
}
