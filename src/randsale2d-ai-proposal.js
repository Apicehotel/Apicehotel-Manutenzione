import { bindLayoutDocument, createLayoutDocument, normalizeLayoutDocument, RANDSALE2D_TYPES, snapValue } from './randsale2d-model.js'

const clean = value => String(value || '').trim()
const lower = value => clean(value).toLowerCase()
const metresToCm = value => Math.round(Number(value) * 100)

function readPax(text, fallback) {
  const match = text.match(/\b(\d{1,4})\s*(?:pax|persone|posti|ospiti)\b/i)
  return match ? Number(match[1]) : (fallback ? Number(fallback) : null)
}

function readStageSize(text) {
  const match = text.match(/(?:palco|pedana)[^\d]{0,12}(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(m|cm)?/i)
  if (!match) return null
  const factor = (match[3] || 'm').toLowerCase() === 'cm' ? 1 : 100
  return { width: Math.round(Number(match[1].replace(',', '.')) * factor), height: Math.round(Number(match[2].replace(',', '.')) * factor) }
}

function addItem(items, type, patch = {}) {
  const preset = RANDSALE2D_TYPES[type]
  if (!preset || items.length >= 250) return
  items.push({ id: `ai-${type}-${items.length + 1}`, type, label: patch.label || preset.label, width: patch.width || preset.width, height: patch.height || preset.height, x: patch.x || 0, y: patch.y || 0, rotation: patch.rotation || 0 })
}

export function createRandSale2DProposal({ booking = {}, prompt, currentDocument = null } = {}) {
  const request = clean(prompt)
  if (request.length < 8) throw new Error('Descrivi meglio l’allestimento richiesto')

  const text = lower(request)
  const base = currentDocument ? normalizeLayoutDocument(currentDocument) : createLayoutDocument({
    roomKey: booking.roomKey,
    roomName: booking.room,
    layoutKey: booking.layoutKey,
    layoutName: booking.layout,
    pax: booking.pax,
  })
  const doc = bindLayoutDocument({ ...base, items: [] }, { ...booking, pax: readPax(request, booking.pax) })
  const items = []
  const margin = 75
  const stageSize = readStageSize(request)

  if (/palco|pedana/.test(text)) {
    const width = Math.min(stageSize?.width || 400, doc.room.width - margin * 2)
    const height = Math.min(stageSize?.height || 200, doc.room.height / 2)
    addItem(items, 'stage', { label: 'Palco', width, height, x: snapValue((doc.room.width - width) / 2, doc.grid), y: /fondo|fondale|in fondo/.test(text) ? margin : snapValue(doc.room.height - height - margin, doc.grid) })
  }
  if (/buffet|coffee break|catering/.test(text)) addItem(items, 'buffet', { label: /coffee break/.test(text) ? 'Coffee break' : 'Buffet', x: margin, y: snapValue(doc.room.height - 140, doc.grid) })
  if (/schermo|proiettore|video/.test(text)) addItem(items, 'screen', { x: snapValue((doc.room.width - RANDSALE2D_TYPES.screen.width) / 2, doc.grid), y: margin })
  if (/tavolo relatori|presidenza|relatori/.test(text)) addItem(items, 'table', { label: 'Tavolo relatori', x: snapValue((doc.room.width - 240) / 2, doc.grid), y: 300, width: 240, height: 80 })

  const pax = doc.pax || 0
  const theatre = /platea|teatro|theatre/.test(text)
  const classroom = /scuola|classroom|banchi/.test(text)
  const uShape = /ferro di cavallo|\bforma u\b|\ba u\b/.test(text)
  const dinner = /cena|banchetto|imperiale|tavoli rotondi/.test(text)

  if (theatre || classroom) {
    const seats = Math.min(Math.max(pax, 12), 160)
    const perRow = theatre ? 10 : 6
    const rows = Math.ceil(seats / perRow)
    const startY = stageSize || /palco/.test(text) ? 350 : 150
    for (let i = 0; i < seats; i += 1) {
      const row = Math.floor(i / perRow), col = i % perRow
      const aisle = /passaggio centrale/.test(text) && col >= Math.floor(perRow / 2) ? 90 : 0
      addItem(items, 'chair', { label: `Sedia ${i + 1}`, x: margin + col * 80 + aisle, y: startY + row * 75 })
    }
  } else if (uShape) {
    const count = Math.min(Math.max(Math.ceil((pax || 20) / 4), 3), 12)
    for (let i = 0; i < count; i += 1) addItem(items, 'table', { label: `Tavolo U ${i + 1}`, x: margin + (i % 4) * 210, y: margin + Math.floor(i / 4) * 140 })
  } else if (dinner) {
    const tables = Math.min(Math.max(Math.ceil((pax || 40) / 8), 1), 20)
    for (let i = 0; i < tables; i += 1) addItem(items, 'table', { label: `Tavolo ${i + 1}`, x: margin + (i % 4) * 240, y: 180 + Math.floor(i / 4) * 160 })
  }

  const document = normalizeLayoutDocument({ ...doc, items })
  const warnings = []
  if (!items.length) warnings.push('La richiesta non contiene ancora elementi riconoscibili: modifica la bozza manualmente.')
  if (pax > 160) warnings.push('La bozza automatica limita a 160 sedie: verifica manualmente capacità e distanze.')
  warnings.push('La proposta è una bozza operativa e non certifica capienza, vie di fuga o conformità antincendio.')

  return {
    status: 'DRAFT',
    authority: 'HUMAN_APPROVAL_REQUIRED',
    source: 'RandAI/RandSale2D proposal contract',
    prompt: request.slice(0, 1000),
    document,
    warnings,
  }
}

export function validateRandSale2DProposal(proposal) {
  if (!proposal || proposal.status !== 'DRAFT' || proposal.authority !== 'HUMAN_APPROVAL_REQUIRED') return false
  const doc = normalizeLayoutDocument(proposal.document)
  return doc.unit === 'cm' && doc.schemaVersion === 1 && doc.items.length <= 250
}
