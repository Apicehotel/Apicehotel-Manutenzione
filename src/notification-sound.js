const STORAGE_KEY = 'apicehotel.notif-sound.v1'

export const SOUNDS = [
  { id: 'classico', label: 'Classico', file: '/sounds/classico.mp3' },
  { id: 'jazz', label: 'Jazz', file: '/sounds/jazz.mp3' },
  { id: 'melodia', label: 'Melodia', file: '/sounds/melodia.mp3' },
  { id: 'miao', label: 'Miao', file: '/sounds/miao.mp3' },
  { id: 'nessuno', label: 'Nessuno', file: null },
]

export function getNotifSound() {
  const id = localStorage.getItem(STORAGE_KEY) || 'classico'
  return SOUNDS.find((sound) => sound.id === id) || SOUNDS[0]
}

export function setNotifSound(id) {
  localStorage.setItem(STORAGE_KEY, id)
}

// Da chiamare quando arriva un nuovo avviso/segnalazione con l'app aperta
// (il suono di sistema della notifica push si sente solo ad app chiusa).
export function playNotifSound() {
  const sound = getNotifSound()
  if (!sound.file) return
  try { new Audio(sound.file).play().catch(() => {}) } catch { /* dispositivo senza supporto audio, non bloccante */ }
}
