---
name: repo-radar
description: Scansiona e valuta repository, capability catalog, skill e plugin esterni per migliorare RandApp, RandAI e l'intero ecosistema senza creare sistemi concorrenti.
---

# Scope

RandRadar parte dall'inventario reale e vivo dell'ecosistema Rand, non da categorie generiche isolate. Deve coprire tutte le pagine e capacità operative presenti in RandApp, tutti i moduli governati dell'ecosistema e i fronti di evoluzione di RandAI. Cerca sia miglioramenti/sostituzioni di ciò che esiste sia capacità nuove che possano portare un beneficio misurabile.

I cataloghi di capability, incluso `https://github.com/openai/plugins`, sono fonti di scouting e non trust root. Un plugin o una skill trovati in un catalogo ufficiale non diventano automaticamente codice Rand, dipendenza runtime o autorità produttiva.

# Permissions

La skill può analizzare, scoprire, confrontare e proporre; installazioni, sostituzioni e modifiche al codice seguono sempre i gate di sviluppo e sicurezza.

# Allowed actions

- Derivare il perimetro di scouting dal catalogo vivo delle pagine RandApp e dal manifest dell'ecosistema.
- Cercare miglioramenti per applicazione, UX, operatività, piattaforma, affidabilità, sicurezza, dati e AI.
- Cercare evoluzioni RandAI per agent runtime, model routing, tool/MCP, memoria, RAG, eval, observability, guardrail, multimodale, voice, coding agent, learning, costi e context engineering.
- Esaminare repository, manifest di plugin, skill, MCP, hook e capability catalog come fonti governate.
- Confrontare capacità, licenza, maturità, manutenzione, sicurezza, compatibilità, benchmark, rollback e costo di adozione.
- Assegnare ogni capacità esterna a un proprietario canonico Rand prima di proporre l'adozione.
- Classificare `AGGIUNGI`, `SOSTITUISCI`, `IGNORA` o `FONTE` con motivazione; per i plugin usare anche `ADOPT_PATTERN`, `ADAPT`, `CONNECT`, `WATCH`, `IGNORE`.

# Forbidden actions

- Nessuna installazione automatica di codice non revisionato.
- Nessun plugin ottiene autorità produttiva solo perché proviene da una fonte ufficiale o affidabile.
- Nessun codice proprietario viene copiato/vendorizzato senza un diritto esplicito; usare un'integrazione esterna quando consentito.
- Nessun giudizio basato solo su stelle o popolarità.
- Nessun exploit/tool offensivo nel runtime di produzione.
- Nessun secondo sistema concorrente quando esiste già un proprietario canonico Rand.
- Nessun agente può usare una capability esterna per aggirare branch, PR, review umana, RLS/RPC, RandTool Gateway o release gate.

# Workflow

1. Costruisci il perimetro dal live inventory RandApp + ecosistema + fronti evolutivi RandAI.
2. Genera scouting mirato per ogni capacità e cerca anche capacità nuove ad alto valore.
3. Deduplica le candidate e identifica la capacità reale di ciascuna.
4. Confronta con inventario, proprietario canonico e dipendenze Rand.
5. Valuta licenza, attività, sicurezza, compatibilità, benchmark, rollback e costo di adozione.
6. Per cataloghi plugin/skill, determina `REFERENCE_ONLY` o `CONNECTOR` e impedisci auto-installazione/autorità produttiva.
7. Cerca una soluzione migliore prima di aggiungere complessità.
8. Produci decisione, rischi, benefici e destinazione architetturale.
9. Se la decisione porta a codice, passa a RandFlow: branch dedicato → implementazione minima → test → security/CI → PR → revisione umana → merge.

# Validation

La copertura `RAND_FULL_EVOLUTION_V1` deve risultare completa per pagine, moduli e fronti AI. Ogni decisione deve indicare cosa cambia, cosa non cambia e perché non crea un secondo sistema concorrente. Discovery non equivale ad approvazione e non può auto-installare o auto-sostituire codice. I candidati da `openai/plugins` devono rispettare `src/randai/discovery/openai-plugin-catalog.js`.
