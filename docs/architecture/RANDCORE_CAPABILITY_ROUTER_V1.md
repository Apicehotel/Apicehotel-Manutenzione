# RandCore Capability Router v1

Il Capability Router è il layer canonico che separa una capacità logica dal provider tecnico che la esegue. È stato introdotto prendendo come riferimento il pattern di capability routing osservato in `shy3130/tick-stock-panel`, senza importare il relativo stack finanziario o di storage.

## Obiettivi

- un solo punto di selezione provider per capacità;
- provider registrabili/rimovibili senza creare runtime paralleli;
- scelta deterministica per priorità;
- preflight di disponibilità;
- fail-closed quando nessun provider è disponibile;
- fallback post-esecuzione vietato di default;
- fallback ammesso solo quando esplicitamente richiesto e l'errore dichiara retry sicuro;
- tool footprint minimo e privo degli input operativi;
- snapshot health per RandCore.

## Contratto

`RandCapabilityRouter.register(provider)` registra un provider con:

- `id` univoco;
- elenco `capabilities`;
- `priority` crescente;
- `isAvailable()` per il preflight;
- `execute()` per l'esecuzione;
- `getHealth()` opzionale.

La registrazione restituisce una funzione di unregister, così i provider restano realmente rimovibili.

## Sicurezza fallback

Per una mutazione protetta un timeout non prova automaticamente un secondo provider: il primo potrebbe aver completato la scrittura e perso soltanto la risposta.

Per questo `allowExecutionFallback` è `false` di default. Il fallback dopo un tentativo è consentito soltanto quando:

1. il chiamante lo abilita esplicitamente;
2. l'errore ha `safeToRetry === true` oppure codice `CAPABILITY_PROVIDER_UNAVAILABLE`;
3. esiste un provider successivo.

Le azioni operative RandAI usano `allowExecutionFallback: false`.

## Integrazione iniziale

La capability iniziale è:

`operational.action → randgateway`

Percorso:

`Action Gateway → RandCapabilityRouter → RandGateway → Tool Gateway → RandSecure/HITL → audit`

Il router non sostituisce autorizzazione, RLS, HITL, audit o RandGateway.

## Observability

Ogni invocazione produce una trace minima:

- capability;
- provider selezionato;
- esito;
- durata;
- numero di fallback;
- error code quando presente.

Gli input non vengono copiati nella trace. Un errore dell'handler di telemetria non modifica l'esito dell'operazione.

## Health

`healthSnapshot()` restituisce per provider:

- disponibilità;
- stato HEALTHY / DEGRADED / DISABLED;
- capabilities;
- priorità.

`UNKNOWN` non viene promosso implicitamente a HEALTHY da integrazioni esterne: ogni adapter futuro deve normalizzare il proprio stato in modo conservativo.

## Estensioni previste

Provider futuri possono coprire notifiche, AI provider, OCR, storage documentale, meteo o sensori. Devono riusare questo router invece di introdurre selettori paralleli.

Per notifiche e scritture operative si deve preservare idempotenza e recipient/hotel scope; nessun fallback automatico è ammesso se non è dimostrabilmente retry-safe.
