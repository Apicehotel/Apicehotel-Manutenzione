---
name: repo-radar
description: Scansiona e valuta repository e fonti esterne per migliorare RandApp, RandAI e l'intero ecosistema senza creare sistemi concorrenti.
---

# Scope

RandRadar parte dall'inventario reale e vivo dell'ecosistema Rand, non da categorie generiche isolate. Deve coprire tutte le pagine e capacità operative presenti in RandApp, tutti i moduli governati dell'ecosistema e i fronti di evoluzione di RandAI. Cerca sia miglioramenti/sostituzioni di ciò che esiste sia capacità nuove che possano portare un beneficio misurabile.

# Permissions

La skill può analizzare, scoprire, confrontare e proporre; installazioni, sostituzioni e modifiche al codice seguono sempre i gate di sviluppo e sicurezza.

# Allowed actions

- Derivare il perimetro di scouting dal catalogo vivo delle pagine RandApp e dal manifest dell'ecosistema.
- Cercare miglioramenti per applicazione, UX, operatività, piattaforma, affidabilità, sicurezza, dati e AI.
- Cercare evoluzioni RandAI per agent runtime, model routing, tool/MCP, memoria, RAG, eval, observability, guardrail, multimodale, voice, coding agent, learning, costi e context engineering.
- Confrontare capacità, licenza, maturità, manutenzione, sicurezza, compatibilità, benchmark, rollback e costo di adozione.
- Classificare `AGGIUNGI`, `SOSTITUISCI`, `IGNORA` o `FONTE` con motivazione.

# Forbidden actions

- Nessuna installazione automatica di codice non revisionato.
- Nessun giudizio basato solo su stelle o popolarità.
- Nessun exploit/tool offensivo nel runtime di produzione.
- Nessun secondo sistema concorrente quando esiste già un proprietario canonico Rand.

# Workflow

1. Costruisci il perimetro dal live inventory RandApp + ecosistema + fronti evolutivi RandAI.
2. Genera scouting mirato per ogni capacità e cerca anche capacità nuove ad alto valore.
3. Deduplica le candidate e identifica la capacità reale di ciascuna.
4. Confronta con inventario, proprietario canonico e dipendenze Rand.
5. Valuta licenza, attività, sicurezza, compatibilità, benchmark, rollback e costo di adozione.
6. Cerca una soluzione migliore prima di aggiungere complessità.
7. Produci decisione, rischi, benefici e destinazione architetturale.

# Validation

La copertura `RAND_FULL_EVOLUTION_V1` deve risultare completa per pagine, moduli e fronti AI. Ogni decisione deve indicare cosa cambia, cosa non cambia e perché non crea un secondo sistema concorrente. Discovery non equivale ad approvazione e non può auto-installare o auto-sostituire codice.
