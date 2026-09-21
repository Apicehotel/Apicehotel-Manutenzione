import { isTransientNetworkError } from './offline-store.js'
import { supabase } from './supabase.js'
import {
  PRESENCE_DISPLAY_ROLES,
  PRESENCE_MAX_MS,
  buildColleaguePresenceRows,
  isPresenceActive,
  namesMatch,
  normalizePersonName,
} from './home-presence-logic.js'

export {
  PRESENCE_DISPLAY_ROLES,
  PRESENCE_MAX_MS,
  buildColleaguePresenceRows,
  isPresenceActive,
  namesMatch,
  normalizePersonName,
}

const onlineNow = () => typeof navigator === 'undefined' || navigator.onLine

export async function fetchPeopleInStructure(hotelId) {
  if (!hotelId || !supabase || !onlineNow()) {
    return { people: [], ok: false, offline: true }
  }
  try {
    const { data, error } = await supabase
      .from('utenti')
      .select('id,nome,ruolo,in_struttura,in_struttura_dal,in_struttura_hotel_id,active')
      .eq('in_struttura_hotel_id', hotelId)
      .eq('active', true)
      .eq('in_struttura', true)
    if (error) throw error
    return { people: data || [], ok: true, offline: false }
  } catch (error) {
    return {
      people: [],
      ok: false,
      offline: isTransientNetworkError(error),
      error: error?.message || String(error),
    }
  }
}
