const utf8 = new TextEncoder()
const utf8Decoder = new TextDecoder()

const subtle = () => {
  const value = globalThis.crypto?.subtle
  if (!value) throw new Error('Web Crypto non disponibile: RandChat E2EE richiede HTTPS e un browser compatibile')
  return value
}

const randomBytes = (size) => {
  const bytes = new Uint8Array(size)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

export const bytesToBase64 = (value) => {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  if (globalThis.Buffer) return globalThis.Buffer.from(bytes).toString('base64')
  throw new Error('Encoder base64 non disponibile')
}

export const base64ToBytes = (value) => {
  const input = String(value || '')
  if (typeof atob === 'function') {
    const binary = atob(input)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  if (globalThis.Buffer) return new Uint8Array(globalThis.Buffer.from(input, 'base64'))
  throw new Error('Decoder base64 non disponibile')
}

export const canonicalPublicJwk = (jwk = {}) => ({
  kty: jwk.kty,
  crv: jwk.crv,
  x: jwk.x,
  y: jwk.y,
  ext: true,
})

const canonicalJwkText = (jwk) => {
  const key = canonicalPublicJwk(jwk)
  return `${key.kty}|${key.crv}|${key.x}|${key.y}`
}

const contentAad = ({ threadId, messageId, senderUserId, senderDeviceRowId }) => utf8.encode(
  `randchat-dm-v1|content|${threadId}|${messageId}|${senderUserId}|${senderDeviceRowId}`,
)

const wrapAad = ({ threadId, messageId, deviceRowId }) => utf8.encode(
  `randchat-dm-v1|wrap|${threadId}|${messageId}|${deviceRowId}`,
)

const signatureData = ({ threadId, messageId, senderUserId, senderDeviceRowId, ciphertext, contentIv, ephemeralPublicKeyJwk }) => utf8.encode([
  'randchat-dm-v1',
  threadId,
  messageId,
  senderUserId,
  senderDeviceRowId,
  contentIv,
  canonicalJwkText(ephemeralPublicKeyJwk),
  ciphertext,
].join('|'))

async function makeStoredKeyPair(algorithm, usages) {
  const cryptoApi = subtle()
  const pair = await cryptoApi.generateKey(algorithm, true, usages)
  const [publicJwk, privateJwk] = await Promise.all([
    cryptoApi.exportKey('jwk', pair.publicKey),
    cryptoApi.exportKey('jwk', pair.privateKey),
  ])
  const privateKey = await cryptoApi.importKey('jwk', privateJwk, algorithm, false, usages.filter((usage) => usage !== 'verify'))
  return { privateKey, publicKeyJwk: canonicalPublicJwk(publicJwk) }
}

export async function generateDeviceCryptoIdentity() {
  const [encryption, signing] = await Promise.all([
    makeStoredKeyPair({ name: 'ECDH', namedCurve: 'P-256' }, ['deriveKey']),
    makeStoredKeyPair({ name: 'ECDSA', namedCurve: 'P-256' }, ['sign', 'verify']),
  ])
  return {
    encryptionPrivateKey: encryption.privateKey,
    encryptionPublicKeyJwk: encryption.publicKeyJwk,
    signingPrivateKey: signing.privateKey,
    signingPublicKeyJwk: signing.publicKeyJwk,
  }
}

async function importEcdhPublic(jwk) {
  return subtle().importKey('jwk', canonicalPublicJwk(jwk), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
}

async function importSigningPublic(jwk) {
  return subtle().importKey('jwk', canonicalPublicJwk(jwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
}

async function deriveWrapKey(privateKey, publicJwk) {
  const publicKey = await importEcdhPublic(publicJwk)
  return subtle().deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptDmPayload({
  threadId,
  messageId,
  senderUserId,
  senderDeviceRowId,
  plaintext,
  devices,
  signingPrivateKey,
}) {
  const text = String(plaintext || '').trim()
  if (!text) throw new Error('Messaggio vuoto')
  if (text.length > 8000) throw new Error('Messaggio troppo lungo')
  if (!Array.isArray(devices) || devices.length < 2) throw new Error('Dispositivi destinatari non disponibili')

  const cryptoApi = subtle()
  const contentKey = await cryptoApi.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawContentKey = new Uint8Array(await cryptoApi.exportKey('raw', contentKey))
  const contentIv = randomBytes(12)
  const encryptedContent = await cryptoApi.encrypt(
    { name: 'AES-GCM', iv: contentIv, additionalData: contentAad({ threadId, messageId, senderUserId, senderDeviceRowId }) },
    contentKey,
    utf8.encode(text),
  )

  const ephemeral = await cryptoApi.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
  const ephemeralPublicKeyJwk = canonicalPublicJwk(await cryptoApi.exportKey('jwk', ephemeral.publicKey))

  const envelopes = []
  for (const device of devices) {
    const deviceRowId = device.device_row_id || device.deviceRowId
    if (!deviceRowId || !device.encryption_public_key_jwk) throw new Error('Chiave pubblica dispositivo incompleta')
    const wrapKey = await deriveWrapKey(ephemeral.privateKey, device.encryption_public_key_jwk)
    const wrapIv = randomBytes(12)
    const wrapped = await cryptoApi.encrypt(
      { name: 'AES-GCM', iv: wrapIv, additionalData: wrapAad({ threadId, messageId, deviceRowId }) },
      wrapKey,
      rawContentKey,
    )
    envelopes.push({
      device_id: deviceRowId,
      wrapped_key: bytesToBase64(wrapped),
      wrap_iv: bytesToBase64(wrapIv),
    })
  }

  const ciphertext = bytesToBase64(encryptedContent)
  const contentIvText = bytesToBase64(contentIv)
  const signature = await cryptoApi.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingPrivateKey,
    signatureData({ threadId, messageId, senderUserId, senderDeviceRowId, ciphertext, contentIv: contentIvText, ephemeralPublicKeyJwk }),
  )

  return {
    ciphertext,
    contentIv: contentIvText,
    ephemeralPublicKeyJwk,
    signature: bytesToBase64(signature),
    envelopes,
  }
}

export async function decryptDmPayload({
  message,
  deviceRowId,
  encryptionPrivateKey,
}) {
  if (!message?.wrapped_key || !message?.wrap_iv) {
    const error = new Error('Messaggio cifrato prima della registrazione di questo dispositivo')
    error.code = 'NO_DEVICE_ENVELOPE'
    throw error
  }
  const cryptoApi = subtle()
  const senderSigningKey = await importSigningPublic(message.sender_signing_public_key_jwk)
  const verified = await cryptoApi.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    senderSigningKey,
    base64ToBytes(message.signature),
    signatureData({
      threadId: message.thread_id,
      messageId: message.id,
      senderUserId: message.sender_user_id,
      senderDeviceRowId: message.sender_device_id,
      ciphertext: message.ciphertext,
      contentIv: message.content_iv,
      ephemeralPublicKeyJwk: message.ephemeral_public_key_jwk,
    }),
  )
  if (!verified) {
    const error = new Error('Firma del messaggio non valida')
    error.code = 'BAD_SIGNATURE'
    throw error
  }

  const wrapKey = await deriveWrapKey(encryptionPrivateKey, message.ephemeral_public_key_jwk)
  let rawContentKey
  try {
    rawContentKey = await cryptoApi.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(message.wrap_iv), additionalData: wrapAad({ threadId: message.thread_id, messageId: message.id, deviceRowId }) },
      wrapKey,
      base64ToBytes(message.wrapped_key),
    )
  } catch {
    const error = new Error('Chiave del messaggio non decifrabile su questo dispositivo')
    error.code = 'KEY_UNWRAP_FAILED'
    throw error
  }

  const contentKey = await cryptoApi.importKey('raw', rawContentKey, { name: 'AES-GCM' }, false, ['decrypt'])
  try {
    const plain = await cryptoApi.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(message.content_iv),
        additionalData: contentAad({
          threadId: message.thread_id,
          messageId: message.id,
          senderUserId: message.sender_user_id,
          senderDeviceRowId: message.sender_device_id,
        }),
      },
      contentKey,
      base64ToBytes(message.ciphertext),
    )
    return utf8Decoder.decode(plain)
  } catch {
    const error = new Error('Integrità del messaggio non verificata')
    error.code = 'CONTENT_DECRYPT_FAILED'
    throw error
  }
}
