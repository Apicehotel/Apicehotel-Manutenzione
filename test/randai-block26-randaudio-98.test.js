import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { confirmTranscript, createBrowserRandAudio, createTranscriptArtifact, evaluateRandAudioReadiness, getBrowserAudioCapabilities } from '../src/randai/audio/index.js'
import { EcosystemStatus, getRandEcosystemManifest } from '../src/randai/core/ecosystem.js'

test('98 browser adapter detects STT TTS and recording independently', () => {
  const scope = { SpeechRecognition: class {}, speechSynthesis: {}, SpeechSynthesisUtterance: class {}, MediaRecorder: class {}, navigator: { mediaDevices: { getUserMedia() {} } } }
  assert.deepEqual(getBrowserAudioCapabilities(scope), { stt: true, tts: true, recording: true })
  assert.deepEqual(getBrowserAudioCapabilities({}), { stt: false, tts: false, recording: false })
  assert.equal(createBrowserRandAudio(scope).capabilities.stt, true)
})

test('98 transcripts preserve provenance and hotel scope but are not authority before confirmation', () => {
  const artifact = createTranscriptArtifact({ hotelId: 'hotelgio', text: '  perdita camera 125 ', confidence: .82, capturedAt: 0 })
  assert.equal(artifact.hotelId, 'hotelgio')
  assert.equal(artifact.transcript, 'perdita camera 125')
  assert.equal(artifact.confirmed, false)
  assert.equal(artifact.authority, 'USER_CONFIRMATION_REQUIRED')
  const confirmed = confirmTranscript(artifact, 'perdita acqua camera 125')
  assert.equal(confirmed.confirmed, true)
  assert.equal(confirmed.authority, 'USER_CONFIRMED_TEXT')
  assert.throws(() => createTranscriptArtifact({ hotelId: 'unknown', text: 'x' }), /hotel scope/)
})

test('98 readiness gate refuses a false LIVE claim while iOS WebKit STT is unavailable', () => {
  const result = evaluateRandAudioReadiness()
  assert.equal(result.status, 'DEFERRED')
  assert.equal(result.ttsCoverage, 1)
  assert.equal(result.sttCoverage, 2 / 3)
  assert.deepEqual(result.reasons, ['STT_UNAVAILABLE:ios-webkit'])
  assert.equal(result.decision, 'KEEP_PROGRESSIVE_ENHANCEMENT_NO_CLOUD_PROVIDER')
})

test('98 RandAI exposes governed dictate and read controls without client secrets', () => {
  const assistant = fs.readFileSync(new URL('../src/randai/RandAIAssistant.jsx', import.meta.url), 'utf8')
  assert.match(assistant, /createTranscriptArtifact/)
  assert.match(assistant, /controllala e premi Chiedi per confermare/)
  assert.match(assistant, /Leggi la risposta RandAI/)
  assert.doesNotMatch(assistant, /service_role|OPENAI_API_KEY|apiKey/i)
})

test('98 manifest records the honest PARTIAL deferred outcome with evidence', () => {
  const module = getRandEcosystemManifest().find((item) => item.id === 'randaudio')
  assert.equal(module.status, EcosystemStatus.PARTIAL)
  assert.ok(module.evidence.includes('src/randai/audio/production-gate.js'))
  assert.match(module.description, /deferred/i)
})

test('98 CI keeps RandAudio as a named permanent gate', () => {
  const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
  assert.match(ci, /RandAudio governance and benchmark contracts/)
  assert.match(ci, /npm run test:randaudio/)
})
