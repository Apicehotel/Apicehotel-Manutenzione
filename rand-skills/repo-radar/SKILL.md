---
name: repo-radar
description: Valuta repository e fonti esterne quando RandRadar deve decidere se aggiungere, sostituire, ignorare o usare una risorsa come fonte.
---

# Scope

Valuta la candidata contro l'inventario reale dell'ecosistema Rand, non contro categorie generiche isolate.

# Permissions

La skill può analizzare e proporre; installazioni, sostituzioni e modifiche al codice seguono i gate di sviluppo e sicurezza.

# Allowed actions

- Confrontare capacità, licenza, maturità, manutenzione, sicurezza e compatibilità.
- Cercare sovrapposizioni con RandApp, RandAI, RandMind, RandCore, RandUI e moduli collegati.
- Classificare `AGGIUNGI`, `SOSTITUISCI`, `IGNORA` o `FONTE` con motivazione.

# Forbidden actions

- Nessuna installazione automatica di codice non revisionato.
- Nessun giudizio basato solo su stelle o popolarità.
- Nessun exploit/tool offensivo nel runtime di produzione.

# Workflow

1. Identifica capacità reale della candidata.
2. Confronta con inventario e dipendenze Rand.
3. Valuta licenza, attività, sicurezza e costo di adozione.
4. Cerca una soluzione migliore prima di aggiungere complessità.
5. Produce decisione, rischi, benefici e destinazione architetturale.

# Validation

Ogni decisione deve indicare cosa cambia, cosa non cambia e perché non crea un secondo sistema concorrente.
