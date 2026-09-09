# Rand repository evaluation — stato finale

## Scopo

Questo documento chiude il censimento delle repository valutate nella roadmap corrente. Le repository esterne non diventano automaticamente dipendenze o proprietari di capacità: RandApp mantiene un solo owner canonico per dominio e adotta solo pattern superiori verificati.

## Gruppo 1 — fondazioni

- PI-Desktop → ADAPT_PATTERN / SOURCE: capability isolation, worktree/branch e permission boundary. Nessun runtime PI-Desktop nel PWA.
- obra/superpowers → ADAPT in RandFlow: TDD dove utile, debugging sistematico, evidence-before-completion, review umana.
- ayghri/i-have-adhd → ADAPT in RandFocus: progress reporting operativo, nessun naming clinico nel prodotto.
- cathrynlavery/diagram-design → ADAPT in RandVisual/RandDiagram.
- freestylefly/awesome-gpt-image-2 → SOURCE_ONLY in RandVisual/RandImage.
- liquidslr/system-design-notes → SOURCE_ONLY in RandArchitecture.

## Gruppo 2 — operativo

Il registro runtime canonico è `src/randai/core/operational-source-governance.js`.

- Expensify/App → SOURCE_ONLY.
- MihanEntalpo/cryptboard.io → IGNORE_RUNTIME.
- Caxerion2/Sistem-Housekeeping-Hotel → ADAPT del solo workflow floor-first.
- magnitude-dev/magnitude → SOURCE_ONLY.
- anomalyco/opencode → SOURCE_ONLY.
- zhaoxuya520/reverse-skill → SOURCE_ONLY sandbox/security intelligence.

Nessuna di queste repository entra come dipendenza runtime e nessuna sostituisce implicitamente RandChat, RandFlow, RandCore, Issues o Housekeeping.

## Gruppo 3 — durable/runtime

- RandDurableRuntime → KEEP come owner canonico.
- Trigger.dev → WATCH come eventuale executor server-side per workload reali.
- Inngest → WATCH come alternativa executor.
- Mastra → SOURCE/OPTIONAL agent engine dietro boundary Rand.
- LangGraph → SOURCE_ONLY/reference.

Nessun secondo orchestratore viene introdotto nel PWA.

## Housekeeping — chiusura UI

Il contratto `housekeeping-floor-context.js` mantiene hotel lock, set di piani assegnati e cambio piano fail-closed. La UI corrente `src/housekeeping-v2.jsx` riusa `operational-context.js` per ripristinare e persistere il contesto piano selezionato. Questo evita un secondo selettore hotel e mantiene il cambio piano dentro lo stesso hotel.

La vecchia PR #182 è stata usata solo come fonte del delta UI utile. Le sue migrazioni e modifiche stale a Issues/Shell non vengono trascinate automaticamente nella chiusura finale.

## Stato finale

- Gruppo 1: tecnicamente chiuso; review/merge umano della PR dedicata.
- Gruppo 2: tecnicamente chiuso; review/merge umano della PR dedicata.
- Gruppo 3: KEEP; nessun nuovo codice richiesto.
- Censimento repository: chiuso; nessuna candidata della roadmap corrente resta senza disposizione.

Qualsiasi futura repository passa di nuovo da RandRadar, overlap check, licenza, sicurezza, benchmark, rollback e review umana prima dell'adozione.
