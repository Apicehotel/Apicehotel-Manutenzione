const SPREADSHEET_MAX_BYTES = 20 * 1024 * 1024
const PHOTO_MAX_BYTES = 25 * 1024 * 1024
const PHOTO_MAX_PIXELS = 80_000_000
const PHOTO_MAX_EDGE = 16_384

const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function startsWith(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value)
}

function extensionOf(name = '') {
  const match = String(name).trim().toLowerCase().match(/\.([a-z0-9]+)$/)
  return match?.[1] || ''
}

async function bytesOf(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  if (value?.arrayBuffer) return new Uint8Array(await value.arrayBuffer())
  throw new TypeError('Contenuto file non leggibile')
}

function safeSize(value, bytes) {
  const declared = Number(value?.size)
  return Number.isFinite(declared) ? declared : bytes.byteLength
}

export async function sha256Hex(value) {
  const bytes = await bytesOf(value)
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 non disponibile su questo dispositivo')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function sniffSpreadsheetType(bytes) {
  if (startsWith(bytes, XLS_MAGIC)) return 'xls'
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2]) && [0x04, 0x06, 0x08].includes(bytes[3])) return 'xlsx'
  return null
}

export async function validateSpreadsheetFile(file, { maxBytes = SPREADSHEET_MAX_BYTES } = {}) {
  if (!file) throw new Error('File mancante')
  const bytes = await bytesOf(file)
  const size = safeSize(file, bytes)
  if (!size) throw new Error('File vuoto')
  if (size > maxBytes) throw new Error(`File troppo grande: massimo ${Math.round(maxBytes / 1024 / 1024)} MB`)
  const type = sniffSpreadsheetType(bytes.subarray(0, 16))
  if (!type) throw new Error('Il contenuto non è un vero file XLS/XLSX')
  const extension = extensionOf(file.name)
  if (extension && extension !== type) throw new Error(`Estensione .${extension} non coerente con il contenuto ${type.toUpperCase()}`)
  return { type, size, sha256: await sha256Hex(bytes), bytes }
}

export function sniffImageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: 'jpeg', mime: 'image/jpeg', extension: 'jpg' }
  if (startsWith(bytes, PNG_MAGIC)) return { type: 'png', mime: 'image/png', extension: 'png' }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') return { type: 'webp', mime: 'image/webp', extension: 'webp' }
  return null
}

export async function validatePhotoBinary(value, { maxBytes = PHOTO_MAX_BYTES, fileName = '', declaredMime = '' } = {}) {
  const bytes = await bytesOf(value)
  const size = safeSize(value, bytes)
  if (!size) throw new Error('Foto vuota')
  if (size > maxBytes) throw new Error(`Foto troppo grande: massimo ${Math.round(maxBytes / 1024 / 1024)} MB`)
  const detected = sniffImageType(bytes.subarray(0, 32))
  if (!detected) throw new Error('Formato foto non riconosciuto: usa JPEG, PNG o WebP')
  const extension = extensionOf(fileName || value?.name)
  const acceptedExtensions = detected.type === 'jpeg' ? ['jpg', 'jpeg'] : [detected.extension]
  if (extension && !acceptedExtensions.includes(extension)) throw new Error(`Estensione .${extension} non coerente con il contenuto della foto`)
  const mime = String(declaredMime || value?.type || '').toLowerCase()
  if (mime && mime.startsWith('image/') && mime !== detected.mime && !(detected.type === 'jpeg' && mime === 'image/jpg')) {
    throw new Error(`Tipo dichiarato ${mime} non coerente con il contenuto ${detected.mime}`)
  }
  return { ...detected, size, sha256: await sha256Hex(bytes), bytes }
}

export function validatePhotoDimensions(width, height, { maxPixels = PHOTO_MAX_PIXELS, maxEdge = PHOTO_MAX_EDGE } = {}) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) throw new Error('Dimensioni foto non valide')
  if (w > maxEdge || h > maxEdge || w * h > maxPixels) throw new Error('Risoluzione foto eccessiva')
  return { width: w, height: h, pixels: w * h }
}

export function sanitizeStorageSegment(value, label = 'percorso') {
  const segment = String(value || '').trim()
  if (!segment || segment === '.' || segment === '..' || /[\\/\0]/.test(segment)) throw new Error(`${label} non valido`)
  if (!/^[a-zA-Z0-9_-]{1,96}$/.test(segment)) throw new Error(`${label} contiene caratteri non consentiti`)
  return segment
}

export const FILE_HARDENING_LIMITS = Object.freeze({
  spreadsheetMaxBytes: SPREADSHEET_MAX_BYTES,
  photoMaxBytes: PHOTO_MAX_BYTES,
  photoMaxPixels: PHOTO_MAX_PIXELS,
  photoMaxEdge: PHOTO_MAX_EDGE,
})
