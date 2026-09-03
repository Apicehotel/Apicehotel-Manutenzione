export function getBrowserAudioCapabilities(scope = globalThis) {
  return Object.freeze({
    stt: Boolean(scope?.SpeechRecognition || scope?.webkitSpeechRecognition),
    tts: Boolean(scope?.speechSynthesis && scope?.SpeechSynthesisUtterance),
    recording: Boolean(scope?.MediaRecorder && scope?.navigator?.mediaDevices?.getUserMedia),
  })
}

export function createBrowserRandAudio(scope = globalThis) {
  const capabilities = getBrowserAudioCapabilities(scope)
  let recognition = null

  return Object.freeze({
    capabilities,
    listen({ lang = 'it-IT', onResult, onError, onEnd } = {}) {
      const Recognition = scope?.SpeechRecognition || scope?.webkitSpeechRecognition
      if (!Recognition) throw new Error('STT_NOT_SUPPORTED')
      recognition?.abort?.()
      recognition = new Recognition()
      recognition.lang = lang
      recognition.interimResults = false
      recognition.continuous = false
      recognition.onresult = (event) => {
        const result = event.results?.[event.resultIndex || 0]?.[0]
        if (result?.transcript) onResult?.({ text: result.transcript, confidence: Number.isFinite(result.confidence) ? result.confidence : null })
      }
      recognition.onerror = (event) => onError?.(new Error(event.error || 'STT_FAILED'))
      recognition.onend = () => { recognition = null; onEnd?.() }
      recognition.start()
    },
    stopListening() { recognition?.stop?.() },
    speak(text, { lang = 'it-IT', rate = 1 } = {}) {
      if (!capabilities.tts) throw new Error('TTS_NOT_SUPPORTED')
      scope.speechSynthesis.cancel()
      const utterance = new scope.SpeechSynthesisUtterance(String(text || ''))
      utterance.lang = lang
      utterance.rate = Math.max(.75, Math.min(1.25, rate))
      scope.speechSynthesis.speak(utterance)
      return utterance
    },
    stopSpeaking() { scope?.speechSynthesis?.cancel?.() },
  })
}
