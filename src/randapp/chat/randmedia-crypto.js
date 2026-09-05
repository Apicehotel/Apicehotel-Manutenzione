const subtle = () => {
  const api = globalThis.crypto?.subtle
  if (!api) throw new Error('Web Crypto non disponibile')
  return api
}

const bytesToBase64 = (bytes) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

const base64ToBytes = (value) => {
  const binary = atob(String(value || ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function encryptDmAttachmentBlob(blob) {
  if (!(blob instanceof Blob) || blob.size <= 0) throw new Error('Allegato vuoto')
  const key = await subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  const plaintext = await blob.arrayBuffer()
  const ciphertext = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  const rawKey = new Uint8Array(await subtle().exportKey('raw', key))
  return {
    blob: new Blob([ciphertext], { type: 'application/octet-stream' }),
    key: bytesToBase64(rawKey),
    iv: bytesToBase64(iv),
  }
}

export async function decryptDmAttachmentBlob(cipherBlob, { key, iv, contentType = 'application/octet-stream' } = {}) {
  if (!(cipherBlob instanceof Blob) || cipherBlob.size <= 0) throw new Error('Allegato cifrato non disponibile')
  const cryptoKey = await subtle().importKey('raw', base64ToBytes(key), { name: 'AES-GCM' }, false, ['decrypt'])
  const plaintext = await subtle().decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, cryptoKey, await cipherBlob.arrayBuffer())
  return new Blob([plaintext], { type: contentType || 'application/octet-stream' })
}
