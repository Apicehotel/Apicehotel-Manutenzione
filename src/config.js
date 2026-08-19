export const HOTELS = [
  { id: 'hotel-a', nome: 'Hotel A', citta: 'Roma', attivo: true },
  { id: 'hotel-b', nome: 'Hotel B', citta: 'Milano', attivo: true },
  { id: 'hotel-c', nome: 'Hotel C', citta: 'Firenze', attivo: true },
]

// Gli utenti e le credenziali non vivono nel bundle frontend: vengono caricati
// dalle Edge Function Supabase per la struttura selezionata.
export const UTENTI = []

export const REPARTI = ['Ricevimento', 'Piani', 'Manutenzione', 'Direzione', 'Amministrazione', 'Ristorante', 'Bar', 'Spa']

export const CATEGORIE = [
  { id: 'elettrico', nome: 'Elettrico', icona: '⚡' },
  { id: 'idraulico', nome: 'Idraulico', icona: '💧' },
  { id: 'clima', nome: 'Climatizzazione', icona: '❄️' },
  { id: 'ascensore', nome: 'Ascensori', icona: '🛗' },
  { id: 'serramenti', nome: 'Serramenti', icona: '🚪' },
  { id: 'tv', nome: 'TV / WiFi', icona: '📺' },
  { id: 'altro', nome: 'Altro', icona: '🔧' },
]

export const STATI = {
  aperta: { label: 'Aperta', colore: '#ef4444' },
  assegnata: { label: 'Assegnata', colore: '#f59e0b' },
  in_corso: { label: 'In corso', colore: '#3b82f6' },
  attesa_ricambio: { label: 'Attesa ricambio', colore: '#8b5cf6' },
  risolta: { label: 'Risolta', colore: '#22c55e' },
  chiusa: { label: 'Chiusa', colore: '#6b7280' },
}

export const PRIORITA = {
  bassa: { label: 'Bassa', colore: '#22c55e', ordine: 1 },
  media: { label: 'Media', colore: '#f59e0b', ordine: 2 },
  alta: { label: 'Alta', colore: '#ef4444', ordine: 3 },
  urgente: { label: 'Urgente', colore: '#dc2626', ordine: 4 },
}

export const TIPI_ELEMENTO = [
  { id: 'camera', nome: 'Camera' },
  { id: 'impianto', nome: 'Impianto' },
  { id: 'attrezzatura', nome: 'Attrezzatura' },
  { id: 'area_comune', nome: 'Area comune' },
]
