const HOTELS = new Set(['hotelgio', 'chocohotel', 'brigantino'])

export const RANDAUDIO_VERSION = 1

export function assertAudioHotelScope(hotelId) {
  if (!HOTELS.has(hotelId)) throw new TypeError('RandAudio requires a canonical hotel scope')
  return hotelId
}

export function createTranscriptArtifact({ hotelId, text, provider = 'browser-speech-recognition', confidence = null, capturedAt = Date.now() }) {
  assertAudioHotelScope(hotelId)
  const transcript = String(text || '').trim()
  if (!transcript) throw new TypeError('Transcript text is required')
  return Object.freeze({
    schemaVersion: RANDAUDIO_VERSION,
    hotelId,
    transcript,
    provider,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    capturedAt: new Date(capturedAt).toISOString(),
    confirmed: false,
    authority: 'USER_CONFIRMATION_REQUIRED',
  })
}

export function confirmTranscript(artifact, confirmedText) {
  assertAudioHotelScope(artifact?.hotelId)
  const transcript = String(confirmedText || '').trim()
  if (!transcript) throw new TypeError('Confirmed transcript is required')
  return Object.freeze({ ...artifact, transcript, confirmed: true, confirmedAt: new Date().toISOString(), authority: 'USER_CONFIRMED_TEXT' })
}
