# RandArchitecture — Blocco 3

## Scopo

RandArchitecture trasforma una fonte di studio di system design in un advisor governato per RandAI. Non copia il repository `liquidslr/system-design-notes`, non lo installa nel runtime e non crea un secondo RAG/database.

La funzione del modulo è semplice:

`problema -> segnali -> pattern rilevanti -> verifica evidenze correnti -> KEEP oppure EVALUATE`

Solo dopo evidenza tecnica concreta un cambiamento architetturale può diventare una proposta `ADD` in un workflow separato e soggetto a review.

## Fonte esterna

Repository: `https://github.com/liquidslr/system-design-notes`

Classificazione: `SOURCE_ONLY`.

Motivo: il repository raccoglie note derivate da materiale editoriale sul system design. RandArchitecture usa soltanto concetti generali e pattern riscritti in forma originale; non copia testo sorgente, non lo importa come knowledge base runtime e non presume diritti di redistribuzione.

Policy:

- `runtimeDependency = false`
- `remoteExecution = false`
- `copySourceText = false`
- `extractionPolicy = PARAPHRASE_GENERAL_PATTERNS_ONLY`

## Pattern v1

Il catalogo iniziale comprende:

- idempotenza;
- optimistic concurrency / CAS;
- code asincrone;
- transactional outbox;
- retry con jitter;
- circuit breaker;
- rate limiting;
- observability;
- cache;
- notification fan-out;
- chat delivery.

Non sono ricette obbligatorie. Ogni pattern ha condizioni d'uso e claim da evitare.

## Stato reale RandApp

Il Blocco 3 non riparte da zero. La piattaforma possiede già pattern importanti:

### KEEP

- idempotenza operativa con `operationId`/mutation identity;
- optimistic concurrency con token `updated_at` e CAS;
- retry con jitter;
- observability RandCore/OpenTelemetry;
- cache/offline non autoritativa.

Questi pattern non devono essere duplicati da nuovi framework.

### EVALUATE

- queue asincrone per domini che ne abbiano davvero bisogno;
- transactional outbox quando una mutazione DB e un evento esterno devono restare atomici;
- circuit breaker per provider esterni con failure evidence;
- rate limiting per quota/abuso/noise boundary;
- fan-out notifiche per isolare i canali;
- evoluzione delivery RandChat.

`EVALUATE` non significa `ADD`.

## Collegamento con RandAI e RandCore

RandArchitecture è knowledge di progettazione, non autorità operativa.

- RandCore resta proprietario di security, health, audit, release gate e observability.
- Supabase/RLS/RPC restano autorità dati e permessi.
- RandMind/RandKnowledge restano i proprietari della memoria/knowledge operativa.
- RandArchitecture non modifica automaticamente infrastruttura, schema o provider.
- RandAI può usare l'advisor per proporre una decisione evidence-based.

## Collegamento con RandVisual

Il Blocco 2 e il Blocco 3 si completano:

`RandArchitecture -> decisione/pattern -> RandVisual -> diagramma/infografica`

In futuro un'analisi di code, notifiche, chat o worker potrà essere spiegata con un diagramma senza duplicare logica grafica o architetturale.

## Zombie prevention

Non vengono introdotti:

- un secondo workflow engine;
- un secondo sistema di observability;
- un secondo cache/offline store;
- un secondo permission layer;
- una copia locale del repository di note;
- microservizi solo perché presenti nei pattern di system design.

L'advisor restituisce `KEEP` quando esiste già un proprietario canonico, `EVALUATE` quando servono prove prima di cambiare.

## File

- `src/randai/architecture/catalog.js`
- `src/randai/architecture/advisor.js`
- `src/randai/architecture/index.js`
- `test/randarchitecture-block3.test.js`

## Definition of Done

- fonte esterna governata come `SOURCE_ONLY`;
- nessuna dipendenza runtime;
- catalogo pattern originale e non copiato;
- evidenze correnti RandApp collegate;
- advisor che distingue `KEEP` da `EVALUATE`;
- zero auto-provisioning e zero auto-ADD;
- test anti-regressione;
- manifest ecosistema e README aggiornati;
- branch dedicato + PR + review umana prima di main.
