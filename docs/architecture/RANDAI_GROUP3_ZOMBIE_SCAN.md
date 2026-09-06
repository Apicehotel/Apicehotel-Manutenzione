# Group 3 zombie scan

Verifica prima dell'adozione:

- `src/randai/recovery/*` e `src/reliability/recovery-*` sono vivi e coperti da `test:recovery`; gestiscono failure classification, budget e circuit breaker. Non eliminare.
- `src/randai/core/orchestrator.js` è vivo come orchestratore sincrono/tool-level. Non è un durable workflow engine e non va sostituito alla cieca.
- RandKnowledge Gateway e RandTool Gateway sono boundary dei Gruppi 1-2 e vengono riusati.
- nessun Trigger.dev/Inngest/Mastra/LangGraph runtime è attualmente installato nel bundle, quindi non esiste un framework parallelo da rimuovere.

Risultato: zero cancellazioni zombie provate. Il nuovo durable runtime possiede solo lifecycle/checkpoint/resume/idempotenza e non duplica recovery, authorization, knowledge o tool policy.
