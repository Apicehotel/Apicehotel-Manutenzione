# Rand × OpenAI Plugins — Adoption v1

## Scopo
`openai/plugins` è un catalogo governato per RandRadar, non una dipendenza monolitica né una trust root. Nessun plugin viene installato, copiato o autorizzato automaticamente.

## Proprietari canonici
- RandAI: orchestrazione.
- RandCore: governance, release gate, sicurezza, health e integrazioni.
- RandRadar: discovery, valutazione e intake esterno.
- RandSkills: metodi/competenze governate.
- RandTool Gateway/MCP: accesso controllato ai tool.
- RandUI: design system e frontend quality.
- RandFlow: branch → piano → implementazione → test → sicurezza → CI/review → revisione umana.

Ogni capability esterna deve avere un proprietario Rand esistente. Se crea un secondo sistema concorrente viene adattata, rifiutata o messa in WATCH.

## Invarianti
1. `openai/plugins` è `CAPABILITY_CATALOG` + `SOURCE_ONLY`.
2. `automaticInstall === false`.
3. `productionExecution === false` per la fonte.
4. ogni candidato ha almeno un owner Rand.
5. `productionAuthority === false`.
6. codice proprietario non viene vendorizzato.
7. plugin/connectors non aggirano RLS/RPC, RandTool Gateway, branch protection, release gate o review umana.

## Matrice v1
| Capability | Decisione | Owner | Modalità |
| --- | --- | --- | --- |
| build-web-apps | ADOPT_PATTERN | RandUI + RandSkills | REFERENCE_ONLY |
| plugin-eval | ADAPT | RandRadar + RandSkills | REFERENCE_ONLY |
| codex-security | CONNECT | RandCore | CONNECTOR |
| superpowers | ADAPT | RandCore + RandSkills | REFERENCE_ONLY |
| GitHub | CONNECT | RandCore | CONNECTOR |
| Supabase | CONNECT | RandCore | CONNECTOR |
| Vercel | CONNECT | RandCore | CONNECTOR |
| Figma | WATCH | RandUI | CONNECTOR |
| Sentry | WATCH | RandCore | CONNECTOR |
| PostHog | WATCH | RandCore | CONNECTOR |

Catalogo macchina: `src/randai/discovery/openai-plugin-catalog.js`.

`codex-security` resta esterno perché il plugin dichiara licenza proprietaria. La sicurezza Rand resta sotto RandCore.

## RandFlow v1
`DISCOVER → PLAN → IMPLEMENT → TEST → SECURITY → REVIEW → READY_FOR_HUMAN_MERGE`

Contratti: branch dedicato, modifica minima coerente, TDD dove pratico, debugging sistematico, evidenza prima del completamento, test/security/CI verdi, zero irrisolti, niente merge automatico, niente deploy produzione prima dell'approvazione, review umana obbligatoria.

Implementazione: `src/randai/core/rand-flow-policy.js`.

## Zombie policy
Non vengono creati secondi Repo Radar, tool gateway, sistemi di sicurezza o design system. I pattern esterni confluiscono nei proprietari canonici già esistenti. Nessuna parte esistente viene cancellata senza verifica di riferimenti, dipendenze e rollback.

## Test
- `test/openai-plugin-governance.test.js`
- `test/rand-flow-policy.test.js`
- `test/randai-block3-security-intelligence.test.js`
- `npm test` include automaticamente i nuovi test tramite `node --test test/*.test.js`.
