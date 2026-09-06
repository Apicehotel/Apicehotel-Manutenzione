# RandAI Group 1 — Guardrails, tool governance e observability

## Obiettivo

Il Gruppo 1 rafforza RandAI prima di aumentare memoria e autonomia. Non introduce un secondo RandCore: autorizzazione, hotel scope, Safe Write/RLS/RPC e audit restano autorità canoniche.

## Decisione architetturale

Le tre soluzioni valutate vengono adottate dietro contratti Rand, non come proprietari paralleli:

- **Promptfoo**: evaluation/regression gate in CI; non entra nel bundle runtime della PWA.
- **ToolHive**: runtime MCP opzionale futuro dietro il RandTool Gateway; non concede permessi e non sostituisce RandCore.
- **Phoenix**: backend OTLP opzionale; RandAI continua a emettere OpenTelemetry standard tramite il layer già presente.

Flusso target:

`RandAI / RandSkillRouter → RandTool Gateway → adapter MCP opzionale (ToolHive) → tool`

`RandAI → OpenTelemetry → OTLP endpoint → Phoenix o altro backend compatibile`

`PR / release → test RandTool Gateway → Promptfoo eval → CI gate`

## RandTool Gateway

`src/randai/core/tool-gateway.js` è fail-closed:

1. un tool non registrato viene negato;
2. un tool disabilitato viene negato;
3. serve un caller autenticato;
4. per i tool hotel-scoped servono hotel di origine e destinazione;
5. il cross-hotel viene negato;
6. tutti gli scope dichiarati devono essere presenti;
7. il modello vede soltanto la lista di tool già autorizzati.

Il gateway restringe capacità; non può creare nuovi permessi. Per le mutazioni reali continuano a valere RLS/RPC, Safe Write/Action Gateway e audit.

## Observability AI

`src/randai/core/ai-observability.js` aggiunge span `randai.*` sopra `src/external-telemetry.js`.

La scelta evita un SDK Phoenix dedicato e mantiene il backend sostituibile. Per usare Phoenix basta configurare l'exporter OTLP esistente verso un endpoint Phoenix compatibile e abilitare OpenTelemetry. Nessun secret deve essere scritto negli attributi degli span.

Attributi ammessi devono restare bounded e privi di contenuto sensibile. Prompt completi, token, PIN, cookie e credenziali non vanno inviati come telemetry attributes.

## Evaluation

La matrice iniziale vive in `evals/randai/promptfooconfig.yaml` e usa un custom provider locale che esercita il boundary reale del RandTool Gateway. Copre almeno:

- allow hotel-scoped con scope corretto;
- deny cross-hotel;
- deny scope insufficiente;
- deny tool inventato dal modello;
- deny tool distruttivo disabilitato;
- deny caller anonimo.

Comandi:

```bash
npm run test:group1
npm run eval:randai:security
```

Promptfoo è fissato alla versione `0.122.2` nel comando CI per evitare variazioni non controllate. Non è una dipendenza runtime.

## CI

`.github/workflows/randai-group1-security.yml` certifica il Gruppo 1 su branch/PR e su `main`. Il merge non deve essere considerato sicuro se il workflow non è verde.

## ToolHive

ToolHive non viene installato dentro la PWA. Quando esisteranno server MCP da esporre in produzione, l'adapter dovrà rispettare queste invarianti:

- riceve soltanto tool già approvati dal RandTool Gateway;
- nessun bypass di hotel scope/RLS/RPC;
- deny-by-default;
- identità e audit propagati senza secret inutili;
- kill switch e rollback indipendenti dal modello;
- nessuna discovery MCP equivale ad autorizzazione.

## Phoenix

Phoenix non diventa il proprietario dei log. È un backend di osservazione opzionale. RandCore resta il punto di controllo per health, costi, audit e release evidence.

## Zombie policy

Nel Gruppo 1 non è stato trovato un duplicato sufficientemente provato da eliminare. In particolare `external-telemetry.js` non è zombie: viene riusato. Nessun file viene cancellato soltanto perché esiste un'alternativa esterna.

## Connessioni future

### Gruppo 2 — RandMind / Graph / RAG

Ogni retrieval e memory lookup potrà produrre span standard e, se diventa un tool, passerà dal gateway. La provenienza di Graphiti/LightRAG non potrà ampliare i permessi del caller.

### Gruppo 3 — runtime / durable execution

Mastra/Trigger.dev dovranno usare lo stesso gateway per le azioni e lo stesso contratto OTLP per tracing. Un workflow ripreso dopo una pausa dovrà rivalidare identità, hotel scope e permessi prima di una mutazione.

## Criterio di completamento

Il Gruppo 1 è completo a livello repository quando:

- i contratti nativi passano;
- la matrice Promptfoo passa in GitHub Actions;
- la build e la CI esistente non regrediscono;
- il branch non introduce dipendenze runtime aggiuntive;
- README e architettura documentano i nuovi confini.
