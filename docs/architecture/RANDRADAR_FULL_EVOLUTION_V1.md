# RandRadar Full Evolution v1

## Obiettivo

`RAND_FULL_EVOLUTION_V1` trasforma Repo Radar da discovery prevalentemente RandUI/AI-core a scouting governato dell'intero prodotto. Il proprietario resta RandRadar esistente: non viene introdotto un secondo motore di discovery o adozione.

## Inventario canonico

Il perimetro viene costruito a runtime da due sorgenti già autorevoli:

- `src/randapp/randui/page-catalog.js`: tutte le destinazioni RandApp con dominio, page type e capability reali;
- `src/randai/core/ecosystem.js`: moduli Rand governati, stato e responsabilità architetturale.

A queste si aggiunge una matrice esplicita di fronti evolutivi RandAI, perché il radar deve scoprire anche capacità nuove e non soltanto alternative a ciò che esiste.

## Copertura AI

La matrice v1 copre agent runtime, model routing, tool use/MCP, memoria, RAG/retrieval, eval, observability, guardrail, multimodale, voice, coding agent, learning, ottimizzazione costi e context engineering.

## Discovery

Ogni elemento dell'inventario produce almeno un profilo di ricerca con `inventoryRef`. Le ricerche continuano sui provider canonici GitHub, GitLab, Codeberg e npm. La copertura RandUI precedente resta attiva come approfondimento specialistico e non viene sostituita.

Le candidate vengono deduplicate per repository canonica e la selezione resta bounded (`MAX_DISCOVERED=80`, massimo 2 per settore). Stelle e popolarità restano segnali deboli di discovery, non criteri di adozione.

## Governance

Le candidate automatiche entrano con gate `security`, `compatibility`, `benchmark` e `rollback` sconosciuti. Di conseguenza una scoperta non equivale ad approvazione. Restano invarianti: nessuna auto-installazione, nessuna auto-sostituzione, review umana per l'adozione, licenze governate, blocker sicurezza/manutenzione e superiorità misurabile prima di un replacement.

## Fail closed sulla copertura

`summarizeRepoRadarEvolutionCoverage()` verifica che ogni pagina, ogni modulo governato (eccetto RandRadar stesso) e ogni fronte AI abbiano un profilo. Se manca una voce, lo snapshot fallisce invece di pubblicare una falsa copertura completa.

## Evoluzione futura

Nuove pagine aggiunte al Page Catalog e nuovi moduli aggiunti al manifest entrano automaticamente nell'inventario e fanno fallire il coverage gate finché non è possibile generare un profilo valido. I nuovi fronti AI vengono aggiunti alla matrice evolutiva solo quando rappresentano una capacità distinta e misurabile, evitando duplicazioni e mode prive di beneficio operativo.
