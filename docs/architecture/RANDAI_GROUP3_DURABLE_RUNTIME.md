# RandAI Group 3 — Durable Runtime

## Decisione

RandCore resta l'autorità. RandAI usa un contratto `RandDurableRuntime` piccolo e sostituibile; Trigger.dev, Inngest o altri executor potranno essere collegati dietro adapter solo quando un workload reale lo richiede. Non introduciamo tre orchestratori concorrenti nel PWA.

## Invarianti

- ogni avvio richiede identità, hotel e `workflow:execute`;
- ogni resume rivalida autorizzazione: un'autorizzazione vecchia non è una capability persistente;
- prima di ogni esecuzione/resume la conoscenza può essere ricaricata dal RandKnowledge Gateway;
- ogni workflow richiede una idempotency key;
- un run è legato a `workflowId` + `workflowVersion`; una versione incompatibile fallisce chiusa;
- retry solo per errori marcati esplicitamente `retryable`, sempre entro `maxAttempts`;
- checkpoint minimo, input e output separati; nessuno snapshot RAG diventa source of truth;
- cancellazione e stati terminali sono deterministici;
- OpenTelemetry del Gruppo 1 traccia i resume.

## Connessioni

`RandBrain -> RandSkills -> RandKnowledge Gateway -> RandTool Gateway -> RandDurableRuntime -> Safe Write/RLS -> audit/telemetry`

Il runtime non sostituisce il recovery engine esistente: quello classifica/gestisce recovery locali con budget e circuit breaker; il durable runtime possiede invece lifecycle, checkpoint, resume e idempotenza del workflow. La separazione evita duplicazione zombie.

## Persistenza

`InMemoryDurableStore` è l'adapter deterministico per test/contratto. In produzione il contratto deve essere implementato con persistenza server-side (Supabase/Postgres o executor durable dedicato), senza affidare durabilità al browser.

## Executor esterni

Trigger.dev resta il candidato preferito per job lunghi/costosi TypeScript. Mastra può restare motore agentico. LangGraph rimane reference. Nessuno di questi acquisisce ownership di permessi, memoria canonica, RLS o audit RandCore.

## Gate

`npm run test:group3` verifica fail-closed auth, idempotenza, checkpoint/resume, reauthorization, refresh knowledge e retry bounded. Il workflow CI esegue anche Group 1, Group 2 e recovery preesistente.
