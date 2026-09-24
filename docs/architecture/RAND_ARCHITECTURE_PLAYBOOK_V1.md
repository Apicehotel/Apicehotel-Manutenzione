# Rand Architecture Playbook v1

## Scopo

Questo playbook traduce fonti architetturali esterne in regole operative piccole e verificabili per RandApp/RandAI/RandCore. La fonte iniziale è [Awesome Scalability](https://github.com/binhnguyennus/awesome-scalability), classificata da RandRadar come **FONTE / REFERENCE_ONLY**.

Snapshot di evidenza iniziale verificato il 24 settembre 2026: repository non archiviato, licenza MIT, default branch `master`, README commit `ecd1e3db7c03595e715e691a8e23119440a77778`.

La fonte insegna pattern; non introduce codice, package, microservizi o autorità.

## Regola primaria

**Adattare il pattern al problema reale, non copiare la scala della fonte.**

Rand opera su un perimetro multi-hotel limitato. Un pattern entra nel prodotto solo se:
1. risolve un failure mode osservato o un requisito concreto;
2. riusa il proprietario canonico esistente;
3. è la soluzione minima che migliora affidabilità o operatività;
4. ha test, rollback e osservabilità;
5. non crea un secondo sistema concorrente.

## Pattern canonici

### 1. Chiamate esterne

`request → timeout → retry limitato + jitter → circuit/open state → fallback/degraded → RandAudit`

- Timeout obbligatorio sulle dipendenze di rete.
- Retry solo su errori transitori e con budget finito.
- Mai retry infinito.
- Il fallback non deve mascherare dati stale come freschi.
- Dopo ripetuti fallimenti, degradare in modo esplicito e osservabile.

Applicazioni Rand: Supabase, Telegram, ntfy, Twilio/WhatsApp, provider AI, servizi meteo e sensori.

### 2. Eventi e lavori asincroni

`event → idempotency key → queue/job owner → worker → bounded retry → dead-letter → alert RandCore`

- Un solo owner per scheduler/job lifecycle.
- Ogni side effect deve essere idempotente quando può essere ritentato.
- Dopo il retry budget, l'evento entra in dead-letter/recovery invece di girare in loop.
- RandCore espone backlog, errori, heartbeat e recovery state.

### 3. Gateway e azioni

`adapter → RandGateway → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Gli adapter trasportano; non decidono identità, hotel, ruolo o rischio. Nessun nuovo canale può scrivere direttamente nella source of truth.

### 4. Cache e offline

`source of truth → cache ricostruibile → freshness metadata → soft refresh → explicit stale state`

- Supabase resta source of truth operativa.
- Cache/sessione/IndexedDB sono ricostruibili.
- Nessuna cache diventa authorization plane.
- Offline/stale/error devono essere distinguibili dalla UI.
- Invalidazione e versione contano più dell'aggiunta di nuovi livelli cache.

### 5. Backpressure e rate limiting

`ingress → scope/priority → quota → queue/concurrency limit → shed non-critical → alert`

- Proteggere Supabase e API esterne da burst o agent loop.
- Scope minimo: identità, hotel, canale/capability.
- Le urgenze mantengono una corsia prioritaria governata.
- Il throttling deve essere visibile in diagnostica.

### 6. Observability

`signal → metric/log/trace → threshold/SLO → state → action`

- `UNKNOWN` e `STALE` non sono `HEALTHY`.
- Misurare latenza, error rate, timeout, retry, backlog e failure recovery dove hanno impatto operativo.
- Evitare doppio logging: Sentry/OpenTelemetry/RandCore restano i proprietari canonici.

### 7. Failure e failover

Preferire **graceful degradation + recovery verificabile** a failover complessi non necessari.

- Nessun dual-write automatico tra backend senza una necessità dimostrata.
- Le preview Ocean non diventano implicitamente produzione.
- Backup/restore devono essere provati, non solo dichiarati.
- I canali secondari (es. Telegram backup) non diventano una seconda source of truth.

## Anti-pattern vietati

- Microservizi introdotti solo perché usati da aziende hyperscale.
- Secondo scheduler, secondo auth plane, secondo logger, secondo sistema di retry o seconda source of truth.
- Queue/event bus quando una singola transazione o job già governato basta.
- Cache aggiuntiva senza un bottleneck misurato.
- Retry senza timeout, jitter, limite e idempotenza.
- Stato `healthy` dedotto dall'assenza di errori.
- Adozione basata su stelle, notorietà o “lo usa Netflix/Uber”.

## Protocollo di adozione

Per ogni idea derivata da una FONTE:

1. **Problema** — descrivere il failure mode o requisito Rand.
2. **Owner** — identificare il modulo canonico esistente.
3. **Pattern** — scegliere il pattern minimo dal playbook.
4. **Alternativa semplice** — verificare se basta una correzione locale.
5. **Boundary** — auth, hotel scope, audit, dati e dipendenze.
6. **Test** — unit/integration/e2e/chaos solo dove proporzionato.
7. **Rollback** — percorso di ritorno esplicito.
8. **Evidence** — misurare prima/dopo.
9. **PR** — branch + CI + revisione umana.

## Collegamento RandRadar

RandRadar conserva le fonti architetturali nel catalogo curato con `usageMode=REFERENCE_ONLY`. Nel runtime interno possono restare `WATCH`: questo è intenzionale. Una fonte può essere eccellente come conoscenza senza essere adottabile come codice.

La classificazione umana è:
- **FONTE** per conoscenza/pattern;
- **AGGIUNGI** solo per una capacità concreta che supera i gate;
- **SOSTITUISCI** solo con superiorità misurata;
- **IGNORA** quando non porta beneficio netto.

## Evoluzione

Nuove fonti entrano solo se aggiungono conoscenza non ridondante. Se una fonte diventa obsoleta, la si sostituisce nel catalogo e si aggiornano i pattern interessati; il playbook non deve diventare un archivio zombie.
