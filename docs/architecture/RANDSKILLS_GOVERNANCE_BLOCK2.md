# RandSkills Governance — Blocco 2

Il Blocco 2 chiude la roadmap RandSkills trasformando il catalogo/router del Blocco 1 in un sistema governabile nel tempo, senza creare un secondo motore di apprendimento, una seconda telemetria o un secondo sistema di autorizzazione.

## Principio

Flusso canonico:

`RandAI -> RandSkillRouter -> SkillRegistry -> Tool/Permission Gateway -> Runtime -> evidenze RandMind/Learning/RandCore -> RandSkillGovernance -> lifecycle review/transition`

Proprietari esistenti restano invariati:

- `LearningEngine` raccoglie esperienze verificate e candidate;
- `learningPromotionDecision` decide AUTO / REVIEW / BLOCKED per gli apprendimenti;
- `SkillRegistry` resta l'unico proprietario delle versioni e delle transizioni di stato;
- RandCore/RLS/RPC restano l'autorità per permessi, rischio e mutazioni;
- RandCore health/evidence e gli audit esistenti restano le fonti operative da cui ricavare telemetria.

`RandSkillGovernance` non persiste una seconda copia degli eventi. Consuma snapshot/evidenze già disponibili e produce decisioni deterministiche.

## Lifecycle

Stati esistenti:

`DRAFT -> CANDIDATE -> TESTED -> APPROVED -> DEPRECATED`

con `BLOCKED` nei passaggi consentiti dal contratto `SkillRegistry`.

Il governance layer può classificare una skill come:

- `KEEP`: nessun segnale sufficiente per un intervento;
- `AUTO_APPROVE_ELIGIBLE`: soltanto `TESTED`, LOW risk, testata e con almeno 2 evidenze verificate, senza modifiche a autorizzazioni/schema o operazioni distruttive;
- `REVIEW_REQUIRED`: rischio MEDIUM/HIGH/CRITICAL, cambiamenti di boundary o skill approvata realmente stale;
- `DEPRECATION_REVIEW`: skill ritirata ma ancora referenziata, senza sostituto o con telemetria incompleta;
- `ZOMBIE_CANDIDATE`: solo skill `DEPRECATED/BLOCKED` con evidenza esplicita di zero utilizzo, zero riferimenti e un replacement dichiarato.

`autoApprove()` non introduce una scorciatoia: applica esclusivamente la transizione legale `TESTED -> APPROVED` del registry e solo quando la promotion policy esistente restituisce `AUTO`.

## UNKNOWN non è STALE

L'assenza di telemetria non viene interpretata come zero utilizzi.

Una skill senza dati produce `telemetryObserved=false` e non può diventare stale/zombie per assenza di evidenza. Questo mantiene lo stesso principio fail-closed di RandCore: dati mancanti non possono essere trasformati artificialmente in uno stato certo.

## Overlap detection

Il governance snapshot confronta skill tramite:

- tag;
- pattern tool;
- keyword di routing.

Un overlap sopra soglia genera soltanto `REVIEW_REQUIRED`. Non avvengono merge, sostituzioni o cancellazioni automatiche.

Questo permette a RandRadar e alla futura manutenzione del catalogo di capire quando due competenze stanno convergendo senza distruggere capacità vive.

## Zombie policy

Una skill non è zombie perché vecchia, poco usata o senza telemetria.

La rimozione dal codice richiede sempre, fuori dal governance engine:

1. stato `DEPRECATED` o `BLOCKED`;
2. telemetria attendibile con `usageCount=0`;
3. `referenceCount=0` verificato nel repository/runtime;
4. replacement esplicito e già valido;
5. review umana della rimozione fisica.

Il Blocco 2 quindi può trovare candidati zombie, ma non cancella automaticamente file o skill.

## Osservabilità

Ogni snapshot espone:

- stato/versione/rischio;
- usage/success/failure/fallback count ricevuti dalle fonti esistenti;
- verified evidence count;
- success rate quando calcolabile;
- ultima attività e giorni trascorsi;
- telemetry known/unknown;
- decisione lifecycle e motivo;
- overlap candidates;
- conteggi aggregati per dashboard RandCore/RandAI.

La struttura è pronta per essere mostrata nel control center senza introdurre una seconda dashboard.

## RandRadar

Nessuna repository esterna è necessaria per questo blocco. Le capacità richieste erano già presenti internamente in LearningEngine, promotion policy, SkillRegistry, RandCore evidence e router. Importare un framework esterno avrebbe duplicato sistemi proprietari già coperti dai gate.

RandRadar resta il percorso corretto quando emergerà una capacità realmente mancante, non per sostituire componenti interni già adeguati.

## Zombie scan del blocco

Nessun file viene rimosso in questo blocco: `LearningEngine`, store, promotion policy, SkillRegistry, router e cognitive loop sono tutti proprietari vivi e coperti da test. Il nuovo modulo evita invece future duplicazioni di telemetry/lifecycle store.

## Gate

```bash
npm run skills:validate
npm run test:randskills
npm run test:randskills:governance
npm run test:mind-learning
npm run test:learning
npm test
npm run build
```

La CI completa resta il gate finale prima del merge.
