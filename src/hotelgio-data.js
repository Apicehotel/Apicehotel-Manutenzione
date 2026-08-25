// Compatibilità storica: housekeeping e sensori usano il client unico
// Apice MultiHotel. Per l'import Housekeeping applichiamo privacy by design
// PRIMA della chiamata di rete: il file Slope resta locale e a Supabase
// arrivano solo i campi operativi esplicitamente ammessi.
import { supabase } from './supabase.js'

const normalizeRoomType = (value) => {
  const raw = String(value || '').trim()
  const text = raw.toLowerCase()
  if (text.includes('accessibile') || text.includes('handicap')) return 'Accessibile'
  if (text.includes('suite')) return 'Suite'
  if (text.includes('cantina')) return 'Cantina'
  if (text.includes('superior')) return 'Superior'
  if (text.includes('quadrupla')) return 'Quadrupla'
  if (text.includes('tripla')) return 'Tripla'
  if (text.includes('singola')) return 'Singola'
  if (text.includes('economy')) return 'Economy'
  if (text.includes('standard')) return 'Standard'
  return raw ? 'Standard' : ''
}

export const sanitizeHousekeepingRooms = (rooms) => (Array.isArray(rooms) ? rooms : []).map((room) => ({
  camera: String(room?.camera || '').trim(),
  struttura: String(room?.struttura || room?.gruppo || '').trim(),
  gruppo: String(room?.gruppo || room?.struttura || '').trim(),
  piano: Number.isFinite(Number(room?.piano)) ? Number(room.piano) : null,
  tipologia: normalizeRoomType(room?.tipologia),
  stato_slope: String(room?.stato_slope || 'libera'),
  letti: String(room?.letti || '').trim(),
  arrivo: String(room?.arrivo || '').trim(),
  partenza: String(room?.partenza || '').trim(),
})).filter((room) => room.camera)

export const hotelGioClient = new Proxy(supabase, {
  get(target, prop, receiver) {
    if (prop === 'rpc') {
      return (name, args, options) => {
        if (name === 'carica_camere_giorno' && Array.isArray(args?.p_camere)) {
          return target.rpc(name, { ...args, p_camere: sanitizeHousekeepingRooms(args.p_camere) }, options)
        }
        return target.rpc(name, args, options)
      }
    }
    const value = Reflect.get(target, prop, receiver)
    return typeof value === 'function' ? value.bind(target) : value
  },
})
