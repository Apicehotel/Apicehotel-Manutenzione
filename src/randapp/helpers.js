import { HOTELS, ROLE_PERMISSIONS } from '../config.js'

export const RANDAPP_LOGOS = {
  hotelgio: '/logos/randapp-hotelgio.webp',
  chocohotel: '/logos/randapp-chocohotel.webp',
  brigantino: '/logos/randapp-brigantino.webp',
}

export const logoFor = (hotelId) => RANDAPP_LOGOS[hotelId] || '/logos/apicehotel-mascot.png'
export const cardFor = (hotelId) => HOTELS.find((h) => h.id === hotelId)?.card || '/logos/apicehotel-mascot.png'
export const hotelById = (hotelId) => HOTELS.find((h) => h.id === hotelId) || null

export const normalize = (value) => String(value || '').trim().toLocaleLowerCase('it')

export const permsFor = (user) => ROLE_PERMISSIONS[user?.role] || []
export const can = (user, permission) => permsFor(user).includes(permission)

// Gate di permesso portati 1:1 dal frontend originale (src/App.jsx).
export const canSendUrgent = (u) => ['admin', 'Direzione', 'Direttore Centro Congressi', 'Reception'].includes(u?.role)
export const canManageUrgent = (u) => ['admin', 'manutentore', 'Direttore Centro Congressi', 'Portiere Notturno', 'Reception'].includes(u?.role)
export const canViewUrgent = (u) => canSendUrgent(u) || canManageUrgent(u)
export const canViewTechnicianDirectory = (u) => canSendUrgent(u) || u?.role === 'admin'
export const canCreatePlanned = (u) => ['admin', 'Responsabile', 'Direzione', 'Direttore Centro Congressi'].includes(u?.role)
export const canViewPlanned = (u) => canCreatePlanned(u) || ['manutentore', 'Tecnico esterno', 'Reception'].includes(u?.role)
export const canViewPlanningMenu = (u) => ['admin', 'manutentore', 'Direttore Centro Congressi', 'Reception'].includes(u?.role)
export const canViewTemperature = (u) => ['admin', 'Direzione', 'Direttore Centro Congressi', 'manutentore', 'Reception', 'Colazione Jazz'].includes(u?.role)
export const canViewHousekeeping = (u) => ['admin', 'Direzione', 'Direttore Centro Congressi', 'Portiere Notturno', 'Governante', 'Capo Governante', 'Reception'].includes(u?.role)
export const isAdminUser = (u) => u?.role === 'admin' || Boolean(u?.can_admin) || Boolean(u?.can_access_admin) || can(u, 'manage_users')

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
  if (!file) return resolve(null)
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => resolve(null)
  reader.readAsDataURL(file)
})

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
