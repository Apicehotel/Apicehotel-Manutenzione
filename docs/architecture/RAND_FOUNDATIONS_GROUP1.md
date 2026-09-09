# Rand Foundations — Gruppo 1

## Obiettivo

Il Gruppo 1 consolida le repository/pattern già valutati senza installare runtime paralleli:

- `vastsa/PI-Desktop` → pattern di isolamento, capability e review;
- `obra/superpowers` → metodo già assorbito nel RandFlow canonico;
- `ayghri/i-have-adhd` → output shaping adattato come RandFocus, senza naming clinico;
- `cathrynlavery/diagram-design` → RandVisual `ADAPT`;
- `freestylefly/awesome-gpt-image-2` → RandVisual `SOURCE_ONLY`;
- `liquidslr/system-design-notes` → RandArchitecture knowledge/advisor.

Nessuna di queste repository viene aggiunta come dipendenza runtime per il solo fatto di essere una fonte.

## Proprietari canonici

- Repository freeze / CODEOWNERS / production deploy → policy repository dedicata.
- Lifecycle di sviluppo agente → `RandFlow`.
- Capability gate per azioni agente → `agent-permission-gate.js`.
- Reporting/progresso agente → `RandFocus`.
- Visuali/diagrammi → `RandVisual`.
- Decisioni architetturali evidence-based → `RandArchitecture`.

## Permission Gate

Capability canoniche: `read`, `propose`, `write`, `execute`, `deploy`.

Regole:

- read/propose non richiedono una branch di mutazione;
- write/execute/deploy da agente richiedono branch dedicata;
- un agente non può mutare la base branch (`main` di default);
- deploy produzione è human-only e richiede approvazione umana esplicita.

Il gate non sostituisce RandCore/RLS/RPC per i permessi applicativi: governa il boundary dell'agente di sviluppo.

## RandFocus

RandFocus rende verificabile lo stato comunicato dall'agente: fase, completati/totale, next action, errori, rimanenti, test, security, CI, branch e PR.

`DONE` è fail-closed: è vietato se test/security/CI non sono verdi, se `completed != total` o se rimangono blocker.

## Anti-zombie

Non è stato creato un nuovo RandDev runtime: Superpowers era già rappresentato correttamente da RandFlow (`testDrivenWherePractical`, `systematicDebugging`, `evidenceBeforeCompletion`, `minimalCoherentChange`). Duplicarlo avrebbe creato due proprietari dello stesso lifecycle.

PI-Desktop resta fonte architetturale, non shell/runtime aggiuntivo dentro RandApp.

## Test

`test/rand-foundations-group1.test.js` protegge:

- divieto mutazioni agente su main;
- divieto deploy produzione da agente;
- deploy produzione umano con approvazione esplicita;
- lavoro bounded su branch dedicata;
- divieto di false dichiarazioni `DONE`;
- coerenza RandFocus ↔ RandFlow.

## Stato repository valutate

- PI-Desktop: `ADAPT_PATTERN` / nessuna installazione runtime.
- Superpowers: `ADAPTED` in RandFlow.
- i-have-adhd: `ADAPTED` in RandFocus, solo pattern di output.
- diagram-design: `ADAPT` in RandVisual.
- awesome-gpt-image-2: `SOURCE_ONLY` in RandVisual.
- system-design-notes: `SOURCE_ONLY`/knowledge in RandArchitecture.
