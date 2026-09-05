import test from 'node:test'
import assert from 'node:assert/strict'
import {
  decryptDmPayload,
  encryptDmPayload,
  generateDeviceCryptoIdentity,
} from '../src/randapp/chat/dm-crypto-core.js'

const uuid = () => globalThis.crypto.randomUUID()

async function fixture() {
  const sender = await generateDeviceCryptoIdentity()
  const recipient = await generateDeviceCryptoIdentity()
  const senderUserId = uuid()
  const recipientUserId = uuid()
  const senderDeviceRowId = uuid()
  const recipientDeviceRowId = uuid()
  const threadId = uuid()
  const messageId = uuid()
  const encrypted = await encryptDmPayload({
    threadId,
    messageId,
    senderUserId,
    senderDeviceRowId,
    plaintext: 'Lampadina bagno 214 fulminata',
    devices: [
      { device_row_id: senderDeviceRowId, auth_user_id: senderUserId, encryption_public_key_jwk: sender.encryptionPublicKeyJwk },
      { device_row_id: recipientDeviceRowId, auth_user_id: recipientUserId, encryption_public_key_jwk: recipient.encryptionPublicKeyJwk },
    ],
    signingPrivateKey: sender.signingPrivateKey,
  })
  const baseMessage = {
    id: messageId,
    thread_id: threadId,
    sender_user_id: senderUserId,
    sender_device_id: senderDeviceRowId,
    ciphertext: encrypted.ciphertext,
    content_iv: encrypted.contentIv,
    ephemeral_public_key_jwk: encrypted.ephemeralPublicKeyJwk,
    signature: encrypted.signature,
    sender_signing_public_key_jwk: sender.signingPublicKeyJwk,
  }
  return { sender, recipient, senderDeviceRowId, recipientDeviceRowId, encrypted, baseMessage }
}

test('DM E2EE decrypts only with the recipient device envelope and private key', async () => {
  const f = await fixture()
  const envelope = f.encrypted.envelopes.find((row) => row.device_id === f.recipientDeviceRowId)
  assert.ok(envelope)
  const plaintext = await decryptDmPayload({
    message: { ...f.baseMessage, wrapped_key: envelope.wrapped_key, wrap_iv: envelope.wrap_iv },
    deviceRowId: f.recipientDeviceRowId,
    encryptionPrivateKey: f.recipient.encryptionPrivateKey,
  })
  assert.equal(plaintext, 'Lampadina bagno 214 fulminata')
})

test('sender can read the sent DM from its own per-device envelope', async () => {
  const f = await fixture()
  const envelope = f.encrypted.envelopes.find((row) => row.device_id === f.senderDeviceRowId)
  const plaintext = await decryptDmPayload({
    message: { ...f.baseMessage, wrapped_key: envelope.wrapped_key, wrap_iv: envelope.wrap_iv },
    deviceRowId: f.senderDeviceRowId,
    encryptionPrivateKey: f.sender.encryptionPrivateKey,
  })
  assert.equal(plaintext, 'Lampadina bagno 214 fulminata')
})

test('tampered ciphertext is rejected before plaintext is returned', async () => {
  const f = await fixture()
  const envelope = f.encrypted.envelopes.find((row) => row.device_id === f.recipientDeviceRowId)
  const first = f.baseMessage.ciphertext[0]
  const tamperedCiphertext = `${first === 'A' ? 'B' : 'A'}${f.baseMessage.ciphertext.slice(1)}`
  await assert.rejects(
    decryptDmPayload({
      message: { ...f.baseMessage, ciphertext: tamperedCiphertext, wrapped_key: envelope.wrapped_key, wrap_iv: envelope.wrap_iv },
      deviceRowId: f.recipientDeviceRowId,
      encryptionPrivateKey: f.recipient.encryptionPrivateKey,
    }),
    (error) => error?.code === 'BAD_SIGNATURE',
  )
})

test('a device without an envelope cannot decrypt historical messages', async () => {
  const f = await fixture()
  await assert.rejects(
    decryptDmPayload({
      message: { ...f.baseMessage, wrapped_key: null, wrap_iv: null },
      deviceRowId: uuid(),
      encryptionPrivateKey: f.recipient.encryptionPrivateKey,
    }),
    (error) => error?.code === 'NO_DEVICE_ENVELOPE',
  )
})
