function circuitLabel(diagnostic) {
  if (!diagnostic) return ''
  if (diagnostic.section === 'wine') {
    const floor = diagnostic.floor ? `Piano ${diagnostic.floor}` : 'Wine'
    return diagnostic.circuit ? `${floor} · ${diagnostic.circuit}` : floor
  }
  if (diagnostic.section === 'jazz') return diagnostic.floor ? `Jazz · Piano ${diagnostic.floor}` : 'Jazz'
  return diagnostic.zone_label || 'Impianto'
}

function temperatureText(diagnostic) {
  const values = (diagnostic?.temperatures || []).filter((item) => item?.temperature != null)
  if (diagnostic?.section === 'jazz' && values.length) {
    const item = values[0]
    const status = !item.online ? ' · offline' : item.stale ? ' · dato non recente' : ''
    return `Temperatura Jazz Piano ${diagnostic.floor}: ${item.temperature} °C${status}`
  }
  return values.map((item) => `${item.name || item.device_id}: ${item.temperature} °C`).join(' · ')
}

export function buildIssueRandAISuggestion(guidance) {
  if (!guidance) return null

  const diagnostic = guidance.hvacDiagnostic
  if (diagnostic) {
    const zone = circuitLabel(diagnostic)
    const relay = diagnostic.switch?.status_label || null
    const temperatures = temperatureText(diagnostic)
    let text = ''

    switch (diagnostic.conclusion) {
      case 'circuit-off':
      case 'floor-circuit-off':
        text = `${zone}: il circuito risulta SPENTO. Verifica prima l'attivazione del circuito prima di cercare un guasto a valle.`
        break
      case 'circuit-on-check-downstream':
      case 'floor-circuit-on-check-downstream':
        text = `${zone}: il circuito risulta ATTIVO. Se il problema persiste, il controllo successivo è sulla distribuzione verso la camera/zona o sui componenti locali.`
        break
      case 'check-upstream-data':
        text = `${zone}: prima di valutare l'interruttore, controlla i dati a monte perché una o più letture risultano mancanti, offline o non recenti.`
        break
      case 'check-floor-temperature-data':
        text = `${zone}: la temperatura del piano è disponibile ma il dato non è abbastanza recente o affidabile per concludere. Mostro comunque la lettura rilevata.`
        break
      case 'floor-temperature-available-switch-unmapped':
        text = `${zone}: la temperatura del piano è disponibile, ma l'interruttore del piano non è ancora mappato in RandAI. Non deduco lo stato del circuito.`
        break
      case 'check-circuit-state':
        text = `${zone}: lo stato del circuito non è abbastanza affidabile per concludere. Verifica stato e connessione del dispositivo.`
        break
      default:
        text = `${zone}: RandAI ha trovato dati impianto, ma non abbastanza elementi per una diagnosi affidabile.`
    }

    return {
      title: 'Suggerimento RandAI',
      text,
      detail: [temperatures || null, relay ? `Stato: ${relay}` : null].filter(Boolean).join(' · '),
      source: 'Dati live impianto',
      caution: diagnostic.thresholds_defined === false ? 'Le soglie caldo/freddo non sono ancora definite: le temperature vengono mostrate come dati, non come conferma automatica di funzionamento.' : null,
    }
  }

  const memory = guidance.memory?.[0]
  if (memory?.solution) {
    return {
      title: 'Suggerimento RandAI',
      text: memory.solution,
      detail: memory.cause ? `Causa confermata in memoria: ${memory.cause}` : null,
      source: memory.sourceLabel || 'Memoria RandAI verificata',
      caution: null,
    }
  }

  if (guidance.procedure) {
    const firstStep = guidance.procedure.steps?.[0]
    return {
      title: 'Suggerimento RandAI',
      text: firstStep || guidance.procedure.summary || 'È disponibile una procedura interna collegata a questa segnalazione.',
      detail: guidance.procedure.summary && firstStep ? guidance.procedure.summary : null,
      source: guidance.procedure.sourceLabel || 'Procedura interna approvata',
      caution: guidance.procedure.caution || null,
    }
  }

  return null
}
