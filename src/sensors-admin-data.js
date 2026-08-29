import { supabase } from './supabase.js'

// Gestione visibilità dispositivi eWeLink. Ogni dispositivo fisico ha 3 flag:
// mostra_hotelgio / mostra_chocohotel / mostra_brigantino.

export async function fetchAllSensors() {
  if (!supabase) return { sensors: [], ok: false }
  try {
    const { data, error } = await supabase.from('sensori_temperatura').select('*').order('nome')
    if (error) return { sensors: [], ok: false }
    return { sensors: data || [], ok: true }
  } catch { return { sensors: [], ok: false } }
}

export async function updateSensorVisibility(deviceId, flags) {
  if (!supabase || !deviceId) return false
  try {
    const { error } = await supabase.from('sensori_temperatura').update({
      mostra_hotelgio: !!flags.hotelgio,
      mostra_chocohotel: !!flags.chocohotel,
      mostra_brigantino: !!flags.brigantino,
    }).eq('device_id', deviceId)
    return !error
  } catch { return false }
}

// La sincronizzazione eWeLink usa credenziali e un segreto server-side e viene
// eseguita dal worker/cron. Dal browser ricarichiamo soltanto i dati già sincronizzati.
export async function refreshSensors() {
  return fetchAllSensors()
}
