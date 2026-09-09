# Rand Plugin Eval Adaptation v1

## Scopo

RandApp/RandAI adotta i pattern utili di `openai/plugins` `plugin-eval` senza installare una seconda CLI o creare un secondo evaluator.

Il proprietario canonico resta **Promptfoo + Quality Matrix + RandCore evidence/release gates**.

## Flusso

`candidate capability → Promptfoo/security regression → Rand governed evaluation → Fix First → evidence artifact → human review → RandFlow merge gate`

Il reporter canonico è `scripts/rand-plugin-eval.mjs`; la policy versionata è `evals/randai/plugin-eval-policy.json`.

## Dimensioni obbligatorie

Ogni valutazione deve coprire:

1. security
2. hotel isolation
3. permissions
4. correctness
5. regression
6. cost
7. maintainability
8. rollback

`Fix First` ordina prima sicurezza, isolamento hotel e permessi. Un finding critico blocca il gate.

## Evidenze

La policy richiede almeno:

- `evals/randai/promptfooconfig.yaml`
- `test/quality-matrix.json`
- `.github/workflows/randai-group1-security.yml`

Il workflow Group 1 produce `artifacts/rand-plugin-eval/latest.json` e `latest.md`, caricati come artifact GitHub Actions per 14 giorni.

## Before / after

Il confronto non usa un secondo motore. Si confrontano due report JSON prodotti dallo stesso reporter:

```bash
npm run eval:plugin:compare -- before.json after.json
```

Il confronto espone stato precedente/nuovo, delta dei finding critici e indicatore di miglioramento.

## Comandi

```bash
npm run eval:randai:security
npm run eval:plugin
npm run eval:plugin:compare -- before.json after.json
```

## Boundary di governance

- `plugin-eval` è `ADAPT_PATTERN`, non dipendenza runtime.
- Promptfoo resta l'evaluator canonico.
- Nessun evaluator può concedere permessi o cambiare RLS/RPC/RandCore.
- Nessun PASS abilita merge o deploy automatici.
- La review umana resta obbligatoria.
- Zero finding critici è condizione necessaria, non sufficiente, per la promozione.

## Zombie policy

Non introdurre una seconda CLI/evaluator, un secondo store di risultati o un secondo release gate. Se un pattern esterno duplica una capacità Rand esistente, si assorbe nel proprietario canonico oppure si ignora.
