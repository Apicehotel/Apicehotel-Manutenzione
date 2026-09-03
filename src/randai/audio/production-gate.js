export const RANDAUDIO_REFERENCE_MATRIX = Object.freeze([
  { platform: 'android-chromium', stt: true, tts: true },
  { platform: 'windows-chromium', stt: true, tts: true },
  { platform: 'ios-webkit', stt: false, tts: true },
])

export function evaluateRandAudioReadiness(matrix = RANDAUDIO_REFERENCE_MATRIX) {
  const required = ['android-chromium', 'windows-chromium', 'ios-webkit']
  const rows = new Map(matrix.map((row) => [row.platform, row]))
  const missing = required.filter((platform) => !rows.has(platform))
  const ttsGaps = required.filter((platform) => !rows.get(platform)?.tts)
  const sttGaps = required.filter((platform) => !rows.get(platform)?.stt)
  const reasons = [
    ...missing.map((platform) => `MISSING_BENCHMARK:${platform}`),
    ...ttsGaps.map((platform) => `TTS_UNAVAILABLE:${platform}`),
    ...sttGaps.map((platform) => `STT_UNAVAILABLE:${platform}`),
  ]
  return Object.freeze({
    status: reasons.length ? 'DEFERRED' : 'LIVE_READY',
    reasons,
    ttsCoverage: required.filter((platform) => rows.get(platform)?.tts).length / required.length,
    sttCoverage: required.filter((platform) => rows.get(platform)?.stt).length / required.length,
    decision: reasons.length ? 'KEEP_PROGRESSIVE_ENHANCEMENT_NO_CLOUD_PROVIDER' : 'PROMOTE_LIVE',
  })
}
