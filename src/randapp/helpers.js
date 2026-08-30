import { HOTELS } from '../config.js'
import { canUser } from '../permissions.js'
import { validatePhotoBinary, validatePhotoDimensions } from '../file-hardening.js'

export const RANDAPP_LOGOS = {
  hotelgio: '/logos/randapp-hotelgio.webp',
  chocohotel: '/logos/randapp-chocohotel.webp',
  brigantino: '/logos/randapp-brigantino.webp',
}

export const logoFor = (hotelId) => RANDAPP_LOGOS[hotelId] || '/logos/apicehotel-mascot.png'
export const cardFor = (hotelId) => HOTELS.find((h) => h.id === hotelId)?.card || '/logos/apicehotel-mascot.png'
export const hotelById = (hotelId) => HOTELS.find((h) => h.id === hotelId) || null

export const normalize = (value) => String(value || '').trim().toLocaleLowerCase('it')

export const canSendUrgent = (u) => canUser(u, 'urgent', 'create')
export const canManageUrgent = (u) => canUser(u, 'urgent', 'edit') || canUser(u, 'urgent', 'take_charge') || canUser(u, 'urgent', 'complete')
export const canViewUrgent = (u) => canUser(u, 'urgent', 'view')
export const canViewTechnicianDirectory = (u) => canUser(u, 'technicians', 'view')
export const canCreatePlanned = (u) => canUser(u, 'planning_work', 'create')
export const canViewPlanned = (u) => canUser(u, 'interventions', 'view') || canUser(u, 'planning_work', 'view')
export const canViewPlanningMenu = (u) => canUser(u, 'planning_work', 'view') || canUser(u, 'planning_sale', 'view')
export const canViewTemperature = (u) => canUser(u, 'temperature', 'view')
export const canViewHousekeeping = (u) => canUser(u, 'housekeeping', 'view')
export const isAdminUser = (u) => canUser(u, 'users', 'manage') || canUser(u, 'role_permissions', 'manage') || canUser(u, 'app_settings', 'manage')

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Utente'

export const ISSUE_CATEGORIES = ['Idraulico', 'Elettrico', 'Climatizzazione', 'Arredo', 'Edilizio', 'Giardinaggio', 'Pulizia filtri', 'Idromassaggio', 'Extra Piani', 'Varie']
export const ROOM_STATUS_OPTIONS = [['fermata_libera', 'Fermata libera'], ['fermata_cliente', 'Fermata con cliente'], ['libera', 'Libera'], ['in_arrivo', 'In arrivo']]

export const ISSUE_STATUS_META = {
  todo: { label: 'Da fare', tone: 'todo' },
  waiting: { label: 'Attesa pezzo', tone: 'waiting' },
  tecnico: { label: 'Tecnico', tone: 'tecnico' },
  done: { label: 'Completata', tone: 'done' },
}

export const URGENCY_META = {
  alta: { label: 'Alta', tone: 'high' },
  media: { label: 'Media', tone: 'mid' },
  bassa: { label: 'Bassa', tone: 'low' },
}

export const isToday = (timestamp) => {
  if (!timestamp) return false
  const d = new Date(timestamp)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export const readPhotoAsDataUrl = (file) => new Promise((resolve) => {
  if (!file || !file.size) return resolve(null)
  const reader = new FileReader()
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : ''
    const comma = result.indexOf(',')
    resolve(result.startsWith('data:image/') && comma >= 0 && result.length > comma + 1 ? result : null)
  }
  reader.onerror = () => resolve(null)
  reader.readAsDataURL(file)
})

export const compressPhotoAsDataUrl = async (file) => {
  if (!file || !file.size) return null
  try {
    await validatePhotoBinary(file, { fileName: file.name, declaredMime: file.type })
  } catch (error) {
    console.warn('Foto rifiutata', error)
    return null
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    const fallback = () => { URL.revokeObjectURL(objectUrl); readPhotoAsDataUrl(file).then(resolve) }
    img.onload = () => {
      try {
        validatePhotoDimensions(img.naturalWidth || img.width, img.naturalHeight || img.height)
        const max = 1000
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (w > h && w > max) { h = Math.round((h * max) / w); w = max }
        else if (h > max) { w = Math.round((w * max) / h); h = max }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Canvas non disponibile')
        ctx.drawImage(img, 0, 0, w, h)
        const cols = 6
        const rows = 6
        let allBlack = true
        outer:
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = Math.min(w - 1, Math.round((c + 0.5) * (w / cols)))
            const y = Math.min(h - 1, Math.round((r + 0.5) * (h / rows)))
            const [red, green, blue] = ctx.getImageData(x, y, 1, 1).data
            if (red > 8 || green > 8 || blue > 8) { allBlack = false; break outer }
          }
        }
        URL.revokeObjectURL(objectUrl)
        if (allBlack) return readPhotoAsDataUrl(file).then(resolve)
        resolve(canvas.toDataURL('image/jpeg', 0.6))
      } catch (error) {
        URL.revokeObjectURL(objectUrl)
        console.warn('Compressione foto rifiutata', error)
        resolve(null)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null) }
    img.src = objectUrl
  })
}

export function csvCell(value = '') { return `"${String(value).replaceAll('"', '""')}"` }
export function exportIssuesCsv(issues, hotel) {
  const headers = ['Struttura', 'Camera o zona', 'Problema', 'Gravità', 'Stato', 'Reparto', 'Categoria', 'Data']
  const rows = issues.filter((i) => i.hotelId === hotel.id).map((i) => [hotel.name, i.room, i.title, i.urgency, i.status, i.department, i.category, i.date])
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `segnalazioni-${hotel.id}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
