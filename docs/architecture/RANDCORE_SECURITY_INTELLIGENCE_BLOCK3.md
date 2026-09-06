# RandCore Security Intelligence + RandRadar — Blocco 3

Il Blocco 3 completa la roadmap Fondamenta → Cervello → Sicurezza senza introdurre un motore offensivo dentro RandApp.

## Obiettivo

Separare nettamente quattro concetti:

1. repository candidate da adottare;
2. fonti di discovery;
3. fonti di security intelligence;
4. pattern/tooling di analisi utilizzabili soltanto in laboratorio isolato.

## Fonti governate

`src/randai/discovery/source-registry.js` registra tre fonti iniziali:

- `Exploitarium` → `SECURITY_INTELLIGENCE`, source-only;
- `reverse-skill` → `ANALYSIS_PATTERN`, sandbox-only;
- `NoSignups/FckSignups` → `DISCOVERY`, source-only.

Nessuna fonte può installare codice automaticamente o eseguire contenuto in produzione. Le repository scoperte da una fonte tornano sempre nel normale processo RandRadar di scoring, licenza, sicurezza, compatibilità, benchmark e rollback.

## Security exposure

`src/randai/core/security-intelligence.js` correla finding esterni con l'inventario reale dello stack Rand. Un finding diventa operativo solo quando `component + affectedVersion` coincidono con una versione realmente presente.

La priorità aumenta quando:

- esiste un exploit/PoC pubblico;
- il componente è esposto in produzione.

La priorità diminuisce quando esiste una patch. La presenza di un PoC non autorizza mai la sua esecuzione.

Output canonico: `LOW / MEDIUM / HIGH / CRITICAL` con azione `MONITOR / SCHEDULE_REMEDIATION / PRIORITIZE_PATCH / PATCH_OR_ISOLATE_NOW`.

## reverse-skill

`reverse-skill` viene usato solo come donatore di metodologia. `buildSecurityAnalysisPlan()` impone:

`TRIAGE → STATIC → DYNAMIC → SYNTHESIS`

ma il piano nasce solo se:

- esiste autorizzazione esplicita;
- l'ambiente è isolato;
- non è produzione.

Il contratto fissa inoltre rete `DENY_BY_DEFAULT`, secret vietati, credenziali produzione vietate e `automaticExploitExecution: false`.

## Zombie scan

Repo Radar, Discovery Engine, RandCore health e i gate security preesistenti restano vivi. Non viene creato un secondo scanner di repository né un secondo health engine. Il nuovo codice aggiunge il tipo di sorgente e il livello di correlazione/esposizione che prima mancavano.

## Gate

```bash
npm run test:security-intelligence
npm run test:repo-radar
npm run test:operations-security
npm run test:core-health
npm test
npm run build
```

Il merge resta subordinato alla CI completa, inclusi browser, device, RandCore evidence/full-health e LTS.
