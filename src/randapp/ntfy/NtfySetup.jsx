import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Icon } from '../ui.jsx'
import { buildNotificationAlias, buildNotificationShortUrl } from '../notification-alias.js'
import { ENABLE_PREFIX, VERIFIED_PREFIX, friendlyNtfyError, getStore, invokeNtfy, setStore } from './ntfy-client.js'

const channelIcon = (id) => id === 'urgent' ? 'warning' : id === 'housekeeping' ? 'housekeeping' : id === 'assignments' ? 'wrench' : 'bell'

export default function NtfySetup({ hotelId, notificationCode='' }) {
  const enabledKey = useMemo(() => `${ENABLE_PREFIX}${hotelId}`, [hotelId])
  const verifiedKey = useMemo(() => `${VERIFIED_PREFIX}${hotelId}`, [hotelId])
  const [enabled, setEnabled] = useState(() => getStore(enabledKey) === '1')
  const [verified, setVerified] = useState(() => Boolean(getStore(verifiedKey)))
  const [config, setConfig] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    setEnabled(getStore(enabledKey) === '1')
    setVerified(Boolean(getStore(verifiedKey)))
    setConfig(null)
    setStatus('')
    setError('')
  }, [enabledKey, verifiedKey, notificationCode])

  useEffect(() => {
    if (!enabled || !hotelId || !notificationCode || config) return
    let live = true
    setBusy(true)
    setError('')
    setStatus('Carico notifiche ntfy…')
    invokeNtfy('ntfy-config', hotelId)
      .then((nextConfig) => {
        if (!live) return
        if (!nextConfig.enabled) throw new Error('Nessun canale ntfy disponibile per questo ruolo.')
        setConfig(nextConfig)
        setStatus('')
      })
      .catch((nextError) => {
        if (!live) return
        setStatus('')
        setError(friendlyNtfyError(nextError))
      })
      .finally(() => live && setBusy(false))
    return () => { live = false }
  }, [enabled, hotelId, notificationCode, config, reloadKey])

  const channels = useMemo(() => Array.isArray(config?.channels) && config.channels.length
    ? config.channels
    : (config?.topic ? [{ id: config.channel || 'urgent', label: config.channel === 'reminders' ? 'Promemoria' : config.channel === 'housekeeping' ? 'Housekeeping' : 'Avvisi urgenti', topic: config.topic, alias: '', priority: 5 }] : []), [config])

  const activate = () => { setStore(enabledKey, '1'); setEnabled(true); setError('') }
  const disable = () => { setStore(enabledKey, null); setEnabled(false); setConfig(null); setStatus(''); setError('') }
  const retry = () => { setConfig(null); setError(''); setStatus(''); setReloadKey((value) => value + 1) }
  const copyShortLink = async (channel) => {
    const alias=channel.alias||buildNotificationAlias(hotelId,channel.id,notificationCode)
    const shortUrl=buildNotificationShortUrl(alias)
    if(!shortUrl) return
    try {
      await navigator.clipboard.writeText(shortUrl)
      setStatus(`${channel.label}: link breve copiato ✓`)
    } catch {
      setError('Copia automatica non riuscita. Riprova dal pulsante Copia link.')
    }
  }
  const testAll = async () => {
    if (!channels.length) return
    setBusy(true)
    setError('')
    setStatus(`Invio ${channels.length === 1 ? 'test' : 'test dei canali'}…`)
    try {
      for (const channel of channels) await invokeNtfy('ntfy-alert', hotelId, { test: true, channel: channel.id })
      setStore(verifiedKey, new Date().toISOString())
      setVerified(true)
      setStatus(channels.length === 1 ? 'Test inviato ✓ Controlla ntfy.' : `${channels.length} test inviati ✓ In ntfy devono arrivare tutti i canali configurati.`)
    } catch (nextError) {
      setError(friendlyNtfyError(nextError))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  return <section className="rs-section" data-testid="ntfy-setup">
    <div className="rs-section__head"><h2>Notifiche ntfy</h2>{verified && <span className="rs-badge rs-badge--accent">Testato ✓</span>}</div>
    <Card className="rs-card--pad">
      <p className="rs-ntfy-intro">RandApp usa link brevi personali: per gli interventi un canale personale privato. Il topic ntfy reale non viene mostrato né copiato dalla schermata Profilo.</p>
      {!notificationCode ? <p>Il tuo codice notifiche verrà assegnato automaticamente.</p> : !enabled ? <div className="rs-op-card__actions"><Button type="button" onClick={activate}>Configura ntfy</Button></div> : <>
        {config && <>
          <div className="rs-ntfy-steps"><b>1. Installa ntfy</b><b>2. Apri il link RandApp</b><b>3. Prova le notifiche</b></div>
          {config.apps && <div className="rs-op-card__actions">{config.apps.ios && <a className="rs-button rs-button--outline" href={config.apps.ios} target="_blank" rel="noreferrer">iPhone / iPad</a>}{config.apps.android && <a className="rs-button rs-button--outline" href={config.apps.android} target="_blank" rel="noreferrer">Android</a>}{config.apps.web && <a className="rs-button rs-button--outline" href={config.apps.web} target="_blank" rel="noreferrer">PC / Web</a>}</div>}
          <div style={{display:'grid',gap:10,marginTop:12}}>{channels.map((channel) => {
            const alias=channel.alias||buildNotificationAlias(hotelId,channel.id,notificationCode)||'Canale protetto'
            const shortUrl=buildNotificationShortUrl(alias)
            return <div key={channel.id} className="rs-ntfy-topic" style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr) auto',alignItems:'center',gap:10}}><span style={{width:34,height:34,borderRadius:10,display:'grid',placeItems:'center',background:'var(--rs-surface-2)',color:'var(--rs-cyan)'}}><Icon name={channelIcon(channel.id)}/></span><span style={{minWidth:0}}><strong style={{display:'block'}}>{channel.label}</strong><small style={{display:'block',color:'var(--rs-text-3)'}}>Priorità {channel.priority || 5} · short link RandApp</small><code style={{display:'block',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:4}}>{alias}</code></span><span style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>{shortUrl&&<a className="rs-button rs-button--outline rs-button--sm" href={shortUrl}>Apri</a>}<Button type="button" variant="outline" size="sm" onClick={() => copyShortLink(channel)}>Copia link</Button></span></div>
          })}</div>
          <div className="rs-op-card__actions" style={{marginTop:14}}><Button type="button" onClick={testAll} disabled={busy}>{verified?'Ripeti test notifiche':'Prova notifiche'}</Button><Button type="button" variant="ghost" onClick={disable} disabled={busy}>Nascondi configurazione</Button></div>
        </>}
        {!config && !error && <p>{busy ? 'Caricamento…' : 'Configurazione non disponibile.'}</p>}
        {!config && error && <div className="rs-op-card__actions"><Button type="button" variant="outline" onClick={retry} disabled={busy}>Riprova configurazione</Button></div>}
      </>}
      {status && <p className="rs-success" role="status">{status}</p>}{error && <p className="rs-error" role="alert">{error}</p>}
    </Card>
  </section>
}
