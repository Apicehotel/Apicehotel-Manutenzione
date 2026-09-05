import test from 'node:test'
import assert from 'node:assert/strict'
import { encryptDmAttachmentBlob, decryptDmAttachmentBlob } from '../src/randapp/chat/randmedia-crypto.js'
import { decodeDmMessagePayload, encodeDmMessagePayload } from '../src/randapp/chat/dm-payload.js'

test('DM attachment encrypt/decrypt round-trip preserves bytes while storage sees ciphertext', async () => {
  const source = new Blob([new TextEncoder().encode('manuale tecnico riservato 214')], { type: 'text/plain' })
  const encrypted = await encryptDmAttachmentBlob(source)
  assert.equal(encrypted.blob.type, 'application/octet-stream')
  assert.notEqual(await encrypted.blob.text(), await source.text())
  const decrypted = await decryptDmAttachmentBlob(encrypted.blob, {
    key: encrypted.key,
    iv: encrypted.iv,
    contentType: source.type,
  })
  assert.equal(decrypted.type, 'text/plain')
  assert.equal(await decrypted.text(), await source.text())
})

test('DM v2 payload carries media secrets only inside the encrypted message payload', () => {
  const encoded = encodeDmMessagePayload({
    text: 'Guarda questa foto',
    attachments: [{
      id: 'a1',
      name: 'foto.jpg',
      type: 'image/jpeg',
      size: 1234,
      path: 'dm/thread/message/a1.bin',
      key: 'secret-file-key',
      iv: 'secret-file-iv',
    }],
  })
  const decoded = decodeDmMessagePayload(encoded)
  assert.equal(decoded.version, 2)
  assert.equal(decoded.text, 'Guarda questa foto')
  assert.equal(decoded.attachments.length, 1)
  assert.equal(decoded.attachments[0].key, 'secret-file-key')
  assert.equal(decoded.attachments[0].path, 'dm/thread/message/a1.bin')
})

test('legacy Group B plaintext DM remains compatible with Group C decoder', () => {
  const decoded = decodeDmMessagePayload('Lampadina bagno 214 fulminata')
  assert.equal(decoded.version, 1)
  assert.equal(decoded.text, 'Lampadina bagno 214 fulminata')
  assert.deepEqual(decoded.attachments, [])
})
