# Rand Constitution v1

## Autorità
Questa Constitution governa lo sviluppo dell'ecosistema Rand. Estende RandFlow; non crea un secondo lifecycle, un secondo sistema di autorizzazione o un secondo release gate.

Ordine di autorità per il lavoro di sviluppo:
1. sicurezza, privacy, RLS/RPC e confini RandCore;
2. questa Constitution;
3. specifica RandSpec approvata;
4. piano e task della specifica;
5. implementazione.

In caso di conflitto si applica il livello superiore e il conflitto va registrato nel change log.

## Principi invariabili
1. **Freeze agenti** — nessun agente autonomo può fare push, merge o deploy diretto su `main` o in produzione. Il flusso è branch dedicata → test → PR → revisione umana → merge umano → deploy governato.
2. **Un proprietario canonico per capacità** — non si crea un secondo sistema per autorizzazione, memoria, scheduler, health, logging, navigazione, inventario, discovery, rollback o altre capability già governate.
3. **Spec prima del cambio sostanziale** — feature, refactor architetturali, schema/RLS, nuovi worker, integrazioni e cambi di comportamento richiedono `spec.md`, `plan.md`, `tasks.md` e `change-log.md`. Fix banali/documentazione possono dichiarare `RANDSPEC: N/A` nella PR con motivazione.
4. **Hotel scope fail-closed** — `hotel_id`, membership, RLS/RPC e permission boundary restano autoritativi. La UI non concede permessi.
5. **Safe Write** — mutazioni protette passano dai gateway canonici, con audit e idempotenza quando applicabile. Nessun modello riceve secret o privilegi non necessari.
6. **Mobile-first e accessibilità** — i cambi UI rispettano RandUI, safe-area iOS, touch target, modalità Piccolo/Normale/Grande e la matrice device/browser vigente.
7. **Evidence before completion** — `DONE` richiede evidenza: test pertinenti verdi, security gate, CI prevista e zero issue irrisolte nel perimetro dichiarato.
8. **Reuse prima di rebuild** — durante PLAN RandRadar verifica se esiste una soluzione migliore. Una fonte esterna non viene installata automaticamente: licenza, sicurezza, manutenzione, compatibilità, costo, rollback e overlap vanno valutati.
9. **Migrazioni riproducibili** — database e policy devono poter essere ricostruiti dalle migrazioni/versioni canoniche. Niente baseline manuali non tracciate come requisito nascosto.
10. **No zombie by guess** — codice, file, migrazioni o feature vengono eliminati solo dopo verifica di riferimenti, runtime, dipendenze, dati, rollback e owner.
11. **Minimal coherent change** — niente redesign o riscritture globali se un'estensione coerente risolve il problema. Se una soluzione esistente è chiaramente inferiore e sostituibile in sicurezza, si preferisce la sostituzione governata alla stratificazione di patch.
12. **Osservabilità e recovery** — worker, job, agenti e integrazioni devono esporre stato/errore/evidenza e avere retry bounded, fallback o escalation esplicita quando necessari.
13. **Human-in-the-loop per rischio** — READ_ONLY può essere automatico; LOW_RISK richiede audit; MEDIUM_RISK preview/confirm; HIGH_RISK richiede approvazione umana esplicita. Deploy produzione resta human-only.
14. **Documentazione viva** — README e documenti architetturali devono descrivere lo stato reale, non roadmap ormai superate.
15. **Change protocol** — se i requisiti cambiano, si aggiorna prima la spec (con delta e motivazione), poi plan/tasks, infine il codice. Non si lascia il codice divergere silenziosamente dalla specifica.

## RandSpec lifecycle
`DISCOVER → SPECIFY → PLAN → RANDRADAR → TASKS → IMPLEMENT → TEST → SECURITY → CONVERGE → READY_FOR_HUMAN_MERGE`

RandSpec aggiunge `SPECIFY`, `RANDRADAR`, `TASKS` e `CONVERGE` al RandFlow esistente; RandFlow resta il lifecycle canonico di esecuzione.

## Release Gate minimo
Una PR sostanziale non è pronta finché non sono verificati, dove applicabili:
- RandSpec valida e task coerenti;
- test/unit/contract pertinenti;
- dependency/security audit;
- isolamento multi-hotel/RLS;
- build e bundle budget;
- RandUI/browser/device acceptance per cambi UI;
- migrazioni e rollback per cambi dati;
- health/observability per worker o integrazioni;
- README/documentazione aggiornata;
- codice zombie verificato, non ipotizzato;
- nessun unresolved critico;
- revisione umana.

## Eccezioni
Le eccezioni devono essere esplicite nella PR, limitate nel tempo/perimetro e non possono derogare a sicurezza, isolamento hotel, freeze agenti o revisione umana.
