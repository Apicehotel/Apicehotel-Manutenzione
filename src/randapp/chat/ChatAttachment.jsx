import { useEffect, useState } from 'react'
import { decryptDmAttachment, groupAttachmentUrl } from './randmedia.js'

const formatBytes = (value) => {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ChatAttachment({ attachment, encrypted = false }) {
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const name = attachment?.name || attachment?.display_name || 'Allegato'
  const type = attachment?.type || attachment?.content_type || 'application/octet-stream'
  const size = attachment?.size || attachment?.byte_size || 0

  useEffect(() => () => {
    if (encrypted && url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }, [encrypted, url])

  const open = async () => {
    if (url || busy) return
    setBusy(true); setError('')
    try {
      if (encrypted) {
        const blob = await decryptDmAttachment(attachment)
        setUrl(URL.createObjectURL(blob))
      } else {
        setUrl(await groupAttachmentUrl(attachment))
      }
    } catch (e) { setError(e.message || 'Allegato non disponibile') }
    finally { setBusy(false) }
  }

  const visual = url && type.startsWith('image/') ? <img className="rc-media-preview" src={url} alt={name} />
    : url && type.startsWith('video/') ? <video className="rc-media-preview" src={url} controls playsInline />
      : url && type.startsWith('audio/') ? <audio src={url} controls /> : null

  return <div className="rc-attachment">
    <div><b>{encrypted ? '🔒 ' : '📎 '}{name}</b><small>{formatBytes(size)} · {type}</small></div>
    {!url && <button type="button" onClick={open} disabled={busy}>{busy ? 'Apro…' : 'Apri'}</button>}
    {visual}
    {url && !visual && <a href={url} target="_blank" rel="noreferrer">Apri file</a>}
    {error && <small className="rc-error">{error}</small>}
  </div>
}
