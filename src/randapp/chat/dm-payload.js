export function encodeDmMessagePayload({ text = '', attachments = [] } = {}) {
  const cleanText = String(text || '').trim()
  const safeAttachments = (attachments || []).map((item) => ({
    id: String(item.id || ''),
    name: String(item.name || 'allegato').slice(0, 180),
    type: String(item.type || 'application/octet-stream').slice(0, 120),
    size: Number(item.size || 0),
    path: String(item.path || ''),
    key: String(item.key || ''),
    iv: String(item.iv || ''),
  })).filter((item) => item.id && item.path && item.key && item.iv && item.size > 0)
  return JSON.stringify({ randchat: 2, type: 'message', text: cleanText, attachments: safeAttachments })
}

export function decodeDmMessagePayload(value) {
  const raw = String(value ?? '')
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.randchat === 2 && parsed?.type === 'message') {
      return {
        text: String(parsed.text || ''),
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        version: 2,
      }
    }
  } catch {}
  return { text: raw, attachments: [], version: 1 }
}
