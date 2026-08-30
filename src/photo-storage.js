import { supabase } from './supabase.js'
import { deleteOfflineBlob, getOfflineBlob, putOfflineBlob } from './offline-store.js'
import { sanitizeStorageSegment, validatePhotoBinary } from './file-hardening.js'

const BUCKET = 'maintenance-photos'
const TOKEN_PREFIX = 'offline-blob:'
const SIGNED_TTL = 60 * 60 * 24 * 30

const uuid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:image/')
const isOfflineToken = (value) => typeof value === 'string' && value.startsWith(TOKEN_PREFIX)
const tokenId = (value) => String(value).slice(TOKEN_PREFIX.length)

function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(',', 2)
  if (!body) throw new Error('Foto vuota o non valida')
  const mime = head.match(/^data:([^;]+)/)?.[1] || 'image/jpeg'
  const binary = atob(body)
  if (!binary.length) throw new Error('Foto vuota o non valida')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function verifiedPhotoBlob(blob) {
  const verified = await validatePhotoBinary(blob, { declaredMime: blob?.type })
  return { blob: new Blob([verified.bytes], { type: verified.mime }), verified }
}

export async function stagePhotoOffline(value, meta = {}) {
  if (!isDataUrl(value)) return value
  const raw = dataUrlToBlob(value)
  const { blob, verified } = await verifiedPhotoBlob(raw)
  const hotelId = meta.hotelId ? sanitizeStorageSegment(meta.hotelId, 'hotelId') : null
  const id = await putOfflineBlob(blob, { ...meta, hotelId, sha256: verified.sha256, mime: verified.mime })
  return `${TOKEN_PREFIX}${id}`
}

async function materializePhoto(value) {
  if (isDataUrl(value)) {
    const raw = dataUrlToBlob(value)
    const { blob, verified } = await verifiedPhotoBlob(raw)
    return { blob, verified, cleanupId: null }
  }
  if (isOfflineToken(value)) {
    const id = tokenId(value)
    const row = await getOfflineBlob(id)
    if (!row?.blob || row.blob.size <= 0) throw new Error('Foto offline non più disponibile o vuota sul dispositivo')
    const { blob, verified } = await verifiedPhotoBlob(row.blob)
    return { blob, verified, cleanupId: id, meta: row }
  }
  return null
}

export async function cleanupStagedPhoto(value) {
  if (isOfflineToken(value)) await deleteOfflineBlob(tokenId(value))
}

export async function uploadPhotoValue(value, { hotelId, entity = 'issues', kind = 'photo' } = {}) {
  if (!value || (!isDataUrl(value) && !isOfflineToken(value))) return value || null
  if (!supabase) throw new Error('Supabase non configurato')
  const safeHotelId = sanitizeStorageSegment(hotelId, 'hotelId')
  const safeEntity = sanitizeStorageSegment(entity, 'entity')
  const safeKind = sanitizeStorageSegment(kind, 'kind')
  const materialized = await materializePhoto(value)
  if (!materialized?.blob || materialized.blob.size <= 0) throw new Error('Foto vuota: caricamento annullato')
  if (materialized.meta?.hotelId && materialized.meta.hotelId !== safeHotelId) {
    throw new Error('Foto offline associata a una struttura diversa')
  }
  const objectId = sanitizeStorageSegment(materialized.cleanupId || uuid(), 'objectId')
  const path = `${safeHotelId}/${safeEntity}/${objectId}/${safeKind}.${materialized.verified.extension}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, materialized.blob, {
    cacheControl: '3600',
    contentType: materialized.verified.mime,
    upsert: Boolean(materialized.cleanupId),
  })
  if (error) throw error
  return path
}

export async function signedPhotoUrl(value) {
  if (!value || isDataUrl(value)) return value || null
  if (isOfflineToken(value)) {
    const row = await getOfflineBlob(tokenId(value))
    return row?.blob ? URL.createObjectURL(row.blob) : null
  }
  if (!supabase) return null
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, SIGNED_TTL)
  if (error) {
    console.error('signedPhotoUrl', error)
    return null
  }
  return data?.signedUrl || null
}

export async function hydrateIssuePhotos(item) {
  if (!item) return item
  const [photoData, completionPhotoData] = await Promise.all([
    signedPhotoUrl(item.photoPath || item.photoData),
    signedPhotoUrl(item.completionPhotoPath || item.completionPhotoData),
  ])
  return { ...item, photoData, completionPhotoData }
}

export async function hydratePlannedPhotos(item) {
  if (!item) return item
  const photoAfter = await signedPhotoUrl(item.photoAfterPath || item.photoAfter)
  return { ...item, photoAfter }
}
