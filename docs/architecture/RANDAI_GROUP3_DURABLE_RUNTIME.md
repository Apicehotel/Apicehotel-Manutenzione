# RandAI Group 3 — Durable Runtime

## Decisione

RandCore resta l'autorità. RandAI usa un contratto `RandDurableRuntime` piccolo e sostituibile; un executor esterno viene collegato dietro adapter solo quando un workload reale lo richiede. Non introduciamo orchestratori concorrenti nel PWA.

RandRadar ha confrontato i ruoli di Trigger.dev/Inngest per durable execution, Mastra per orchestrazione agentica TypeScript e LangGraph come riferimento. La scelta è mantenere **RandDurableRuntime come contratto canonico**. Trigger.dev resta il primo candidato executor server-side per job lunghi/costosi; Inngest resta alternativa; Mastra può essere agent engine; LangGraph resta reference. Nessuno acquisisce ownership di permessi, memoria, RLS o audit.

## Invarianti di sicurezza

- ogni avvio richiede identità, hotel e `workflow:execute`;
- ogni resume rivalida identità/hotel/scope: lo stato persistito non è autorizzazione persistita;
- un actor diverso non può sostituire quello originario durante il resume;
- il cross-hotel è fail-closed;
- prima di ogni esecuzione/resume la conoscenza viene risolta nuovamente tramite il boundary governato; uno snapshot RAG non diventa source of truth;
- ogni workflow richiede una idempotency key;
- un run è legato a `workflowId` + `workflowVersion`; una versione incompatibile fallisce chiusa;
- retry solo per errori marcati esplicitamente `retryable`, sempre entro `maxAttempts`;
- checkpoint minimo, input e output restano separati;
- cancellazione e stati terminali sono deterministici;
- le mutazioni restano comunque soggette a RandTool Gateway, Safe Write/RLS e audit;
- OpenTelemetry del Gruppo 1 traccia i resume.

## Connessioni

`RandBrain -> RandSkills -> RandKnowledge Gateway -> RandTool Gateway -> RandDurableRuntime -> Safe Write/RLS -> audit/telemetry`

Il runtime non sostituisce il recovery engine esistente: quello classifica/gestisce recovery locali con budget e circuit breaker; il durable runtime possiede lifecycle, checkpoint, resume e idempotenza. Anche l'orchestrator sincrono/tool-level resta vivo. La separazione evita duplicazioni.

## Persistenza ed executor

`InMemoryDurableStore` è solo l'adapter deterministico di contratto/test. La vera durabilità produttiva deve essere server-side tramite un adapter che implementi lo stesso contratto, ad esempio Supabase/Postgres o un executor durable dedicato. Il browser non è considerato persistence authority.

Nessuna dipendenza Trigger.dev, Inngest, Mastra o LangGraph viene aggiunta al bundle in questo gruppo. L'attivazione di un executor esterno richiede workload concreto, benchmark, security gate, costo misurato e rollback.

## Worker e migrazione

Non migriamo worker economici/event-driven solo per usare il nuovo runtime. Urgenze restano trigger-driven; meteo, sensori e promemoria mantengono gli scheduler governati esistenti finché non emerge un problema di durabilità misurabile.

Candidati futuri: Repo Radar deep scan, check completi RandCore, ingestion/review delle Procedure, analisi AI lunghe e futuro processing fatture. Ogni migrazione sarà workload-by-workload, feature-gated, idempotente e reversibile.

## Costi e rollback

Il Gruppo 3 non abilita servizi esterni ricorrenti e non modifica la policy Vercel. Finché nessun workload opta nel runtime, il comportamento operativo corrente resta invariato. Un adapter futuro deve poter essere disabilitato tornando al percorso governato precedente senza perdita della verità canonica.

## Gate e definition of done

`npm run test:group3` copre authorization, cross-hotel, idempotenza, checkpoint/resume, reauthorization, actor substitution, refresh knowledge, retry bounded/non-retryable, version mismatch, cancel, store contract, export e assenza di runtime paralleli. Il workflow dedicato esegue inoltre Group 1, Group 2 e recovery esistente.

Il Gruppo 3 è certificato solo quando workflow dedicato e CI completa sono verdi e la PR viene squash-mergiata su `main`. L'attivazione di persistenza/executor esterni è una scelta infrastrutturale demand-driven, non un secondo gruppo architetturale incompleto.
