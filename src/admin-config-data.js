import { supabase } from './supabase.js'

// PIN admin unico e condiviso, salvato su app_config (key='admin_pin').
// Prima viveva solo in localStorage (per dispositivo); ora è sul DB così è
// uguale su tutti i dispositivi, come su Hotel Giò.

const KEY = 'admin_pin'
const LEGACY_LOCAL_KEY = 'apicehotel.admin-pin.v1'
const DEFAULT_PIN = '000000'

// Legge il PIN admin dal DB. Migrazione sicura al primo avvio: se il DB non ha
// ancora un valore ma sul dispositivo esiste un PIN già personalizzato in
// localStorage, si porta QUELLO sul DB (non un default), così non si perde un
// PIN già scelto. Se non c'è nulla da nessuna parte, resta il default.
export async function getAdminPin() {
  const local = (() => { try { return localStorage.getItem(LEGACY_LOCAL_KEY) } catch { return null } })()
  if (!supabase) return local || DEFAULT_PIN
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', KEY).maybeSingle()
    if (error) return local || DEFAULT_PIN
    if (data && data.value) {
      // Il DB è la fonte di verità: allineo la copia locale (per i controlli offline).
      try { localStorage.setItem(LEGACY_LOCAL_KEY, data.value) } catch { /* ok */ }
      return data.value
    }
    // Il DB non ha ancora il PIN: se in locale c'è un valore personalizzato, lo migro.
    const toSeed = local || DEFAULT_PIN
    await supabase.from('app_config').upsert({ key: KEY, value: toSeed })
    return toSeed
  } catch {
    return local || DEFAULT_PIN
  }
}

// Salva il nuovo PIN admin sul DB (e allinea la copia locale).
export async function setAdminPin(pin) {
  try { localStorage.setItem(LEGACY_LOCAL_KEY, pin) } catch { /* ok */ }
  if (!supabase) return true
  try {
    const { error } = await supabase.from('app_config').upsert({ key: KEY, value: pin })
    return !error
  } catch { return false }
}
