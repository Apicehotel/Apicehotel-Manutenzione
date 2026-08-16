import { supabase } from './supabase.js'

// Gestione visibilità sensori (pannello admin). Ogni sensore fisico ha 3 flag:
// mostra_hotelgio / mostra_chocohotel / mostra_brigantino.

// Tutti i sensori dell'account, ordinati per nome (per il pannello admin).
export async function fetchAllSensors() {
  if (!supabase) return { sensors: [], ok: false }
  try {
    const { data, error } = await supabase.from('sensori_temperatura').select('*').order('nome')
    if (error) return { sensors: [], ok: false }
    return { sensors: data || [], ok: true }
  } catch { return { sensors: [], ok: false } }
}

// Aggiorna i 3 flag di visibilità di un sensore.
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

// Sincronizza i sensori da eWeLink (chiama la edge function), poi ritorna la
// lista aggiornata. Usato dal pulsante "Sincronizza da eWeLink" nel pannello.
export async function syncSensorsFromEwelink(supabaseUrl) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/sync-sensori-temperatura`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  } catch { /* se non raggiungibile, mostriamo comunque ciò che c'è nel DB */ }
  return fetchAllSensors()
}
