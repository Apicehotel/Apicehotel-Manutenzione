import { generateDeviceCryptoIdentity } from './dm-crypto-core.js'

const DB_NAME = 'randchatE2EE'
const DB_VERSION = 1
const STORE = 'device-identities'

const storageAvailable = () => typeof indexedDB !== 'undefined'

function openDb() {
  if (!storageAvailable()) return Promise.reject(new Error('IndexedDB non disponibile: impossibile proteggere le chiavi E2EE'))
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'userId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Archivio chiavi E2EE non disponibile'))
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      let result
      try { result = fn(store) } catch (error) { reject(error); return }
      tx.oncomplete = () => resolve(result?.result ?? result)
      tx.onerror = () => reject(tx.error || new Error('Errore archivio chiavi E2EE'))
      tx.onabort = () => reject(tx.error || new Error('Operazione archivio chiavi annullata'))
    })
  } finally {
    db.close()
  }
}

export async function getDmDeviceIdentity(userId) {
  if (!userId || !storageAvailable()) return null
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(String(userId))
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error || new Error('Chiavi E2EE non leggibili'))
    })
  } finally { db.close() }
}

export async function putDmDeviceIdentity(identity) {
  if (!identity?.userId || !identity?.deviceId) throw new Error('Identità dispositivo E2EE incompleta')
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(identity)
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error || new Error('Impossibile salvare le chiavi E2EE'))
      tx.onabort = () => reject(tx.error || new Error('Salvataggio chiavi E2EE annullato'))
    })
  } finally { db.close() }
  return identity
}

export async function ensureDmDeviceIdentity(userId) {
  const stableUserId = String(userId || '').trim()
  if (!stableUserId) throw new Error('Utente E2EE mancante')
  const existing = await getDmDeviceIdentity(stableUserId)
  if (
    existing?.deviceId
    && existing?.encryptionPrivateKey
    && existing?.signingPrivateKey
    && existing?.encryptionPublicKeyJwk
    && existing?.signingPublicKeyJwk
  ) return existing

  const cryptoIdentity = await generateDeviceCryptoIdentity()
  const identity = {
    userId: stableUserId,
    deviceId: globalThis.crypto.randomUUID(),
    createdAt: Date.now(),
    ...cryptoIdentity,
  }
  return putDmDeviceIdentity(identity)
}

export async function deleteDmDeviceIdentity(userId) {
  if (!userId || !storageAvailable()) return
  const db = await openDb()
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(String(userId))
      tx.oncomplete = resolve
      tx.onerror = () => reject(tx.error || new Error('Impossibile rimuovere le chiavi E2EE'))
    })
  } finally { db.close() }
}
