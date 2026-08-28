import { useMemo, useState } from 'react'
import { Button, Card } from '../ui.jsx'
import { parseNotificationAlias } from '../notification-alias.js'
import { friendlyNtfyError, resolveNtfyShortLink } from './ntfy-client.js'
import { supabase } from '../../supabase.js'

const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)

export default function NtfyShortLink({ alias }) {
  const parsed=useMemo(()=>parseNotificationAlias(alias),[alias])
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [manual,setManual]=useState('')
  const goLogin=()=>{if(parsed)window.location.replace(`/?ntfy_short=${encodeURIComponent(parsed.alias)}`)}
  const copyTopic=async(topic)=>{await navigator.clipboard.writeText(topic);setManual('Topic ntfy copiato ✓ In ntfy tocca + e incollalo nel campo Topic.')}
  const getResolved=async()=>{const {data}=await supabase.auth.getSession();if(!data?.session){goLogin();return null}return resolveNtfyShortLink(parsed.alias)}
  const open=async()=>{if(!parsed)return;setBusy(true);setError('');setManual('');try{const result=await getResolved();if(!result)return;if(isIOS()){await copyTopic(result.topic);window.location.assign(result.app_link||'https://ntfy.sh/app');return}if(result.subscription_link){window.location.href=result.subscription_link;return}await copyTopic(result.topic)}catch(err){setError(friendlyNtfyError(err))}finally{setBusy(false)}}
  const manualCopy=async()=>{if(!parsed)return;setBusy(true);setError('');try{const result=await getResolved();if(result)await copyTopic(result.topic)}catch(err){setError(friendlyNtfyError(err))}finally{setBusy(false)}}

  if(!parsed)return <main className="rs-page" style={{maxWidth:560,margin:'0 auto',paddingTop:32}}><Card className="rs-card--pad"><h1>Link non valido</h1><p>Questo collegamento notifiche RandApp non è riconosciuto.</p><Button type="button" onClick={()=>window.location.replace('/')}>Apri RandApp</Button></Card></main>
  return <main className="rs-page" style={{maxWidth:560,margin:'0 auto',paddingTop:32}} data-testid="ntfy-short-link"><Card className="rs-card--pad">
    <div className="rs-section__head"><h1>Canale notifiche</h1><span className="rs-badge rs-badge--accent">Protetto</span></div>
    <p>Link breve personale:</p><code style={{display:'block',fontSize:'1.1em',margin:'12px 0'}}>{parsed.alias}</code>
    <p>RandApp verifica identità e autorizzazioni prima di recuperare il topic ntfy reale.</p>
    <div className="rs-op-card__actions"><Button type="button" onClick={open} disabled={busy}>{busy?'Verifico…':isIOS()?'Copia topic e apri ntfy':'Configura in ntfy'}</Button><Button type="button" variant="outline" onClick={goLogin}>Apri RandApp</Button></div>
    <details style={{marginTop:14}}><summary>Configurazione manuale</summary><p><small>Il topic tecnico viene copiato solo dopo il controllo autorizzazioni.</small></p><Button type="button" variant="outline" onClick={manualCopy} disabled={busy}>Copia topic ntfy</Button></details>
    {manual&&<p className="rs-success" role="status">{manual}</p>}{error&&<p className="rs-error" role="alert">{error}</p>}
  </Card></main>
}
