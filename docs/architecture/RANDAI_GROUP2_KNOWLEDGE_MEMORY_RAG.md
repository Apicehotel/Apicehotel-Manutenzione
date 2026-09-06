# RandAI Group 2 — Knowledge, RandMind, Graph e RAG

## Obiettivo

Il Gruppo 2 aumenta la capacità di RandAI di ricordare, collegare e recuperare informazioni senza creare un secondo proprietario dei dati o della memoria.

La separazione canonica è:

- **Supabase/Postgres**: source of truth dei dati operativi RandApp, protetto da RLS/RPC.
- **RandMind**: memoria canonica governata, con provenienza, trust, validità temporale, conflitti, retention e forgetting.
- **Graphiti**: proiezione opzionale e ricostruibile per relazioni temporali/bi-temporali.
- **LightRAG**: proiezione opzionale e ricostruibile per retrieval documentale/ibrido.
- **RandKnowledge Gateway**: unico boundary che autorizza la query, normalizza provenienza/tempo, elimina risultati non conformi e compone il contesto per RandAI.

Nessun indice Graph/RAG può diventare autorità per permessi, mutazioni o verità operativa.

## Perché non installare due nuovi cervelli

RandMind è già LIVE e copre deduplicazione, timeline, qualità fail-closed, conflitti, retention, forgetting e governance database. Sostituirlo con un framework esterno introdurrebbe ownership concorrente e perdita di invarianti già testate.

Graphiti e LightRAG vengono quindi adottati come **motori dietro adapter**, non come dipendenze runtime della PWA. Possono essere eseguiti in futuro come servizi backend/sidecar isolati e possono essere spenti o sostituiti senza perdere la fonte canonica.

## RandKnowledge Gateway

`src/randai/core/knowledge-gateway.js` applica queste regole:

1. caller autenticato obbligatorio;
2. `hotelId` obbligatorio;
3. cross-hotel negato;
4. scope `knowledge:read` obbligatorio;
5. ogni risultato deve avere provenienza `source.kind/source.id`;
6. ogni risultato da una proiezione deve puntare a un `canonicalRef`;
7. ogni risultato deve appartenere esattamente all'hotel autorizzato;
8. validità temporale applicata prima di passare il contesto a RandAI;
9. righe malformate o fuori scope vengono scartate;
10. indisponibilità Graph/RAG degrada in sicurezza: RandMind continua a funzionare;
11. i risultati vengono deduplicati privilegiando a parità di evidenza la fonte canonica rispetto alla proiezione;
12. la query emette tracing tramite il contratto OpenTelemetry del Gruppo 1.

## Contratto dei backend

| Backend | Ruolo | Autorità | Ricostruibile |
| --- | --- | --- | --- |
| RandMind | memoria canonica | sì | no |
| Supabase | dati operativi canonici | sì | no |
| Graphiti | temporal knowledge projection | no | sì |
| LightRAG | retrieval projection | no | sì |

`rebuildable=true` significa che l'indice può essere cancellato e rigenerato dalle fonti canoniche. Non è un backup.

## Graphiti

Il pattern utile è il knowledge graph temporalmente consapevole: aggiornamenti incrementali, relazioni che cambiano nel tempo, query point-in-time e distinzione tra tempo dell'evento e tempo di ingestione.

Nel disegno Rand:

`Supabase / RandMind -> projection worker -> Graphiti -> adapter -> RandKnowledge Gateway`

Il graph non scrive direttamente in RandMind e non può promuovere una relazione estratta a fatto verificato. Un eventuale apprendimento deve continuare attraverso il lifecycle RandMind/RandBrain già governato.

## LightRAG

Il pattern utile è retrieval ibrido documenti + entità/relazioni. Nel disegno Rand:

`Procedure / documenti autorizzati -> bounded ingestion -> LightRAG -> adapter -> RandKnowledge Gateway`

LightRAG non viene esposto direttamente a Internet o al browser. Le API devono stare dietro autenticazione Rand, rete privata/service boundary, limiti di payload/rate e versioni sottoposte al normale security gate. Gli advisory recenti sull'API rendono questa separazione un requisito, non un'opzione.

## Provenienza

Ogni hit deve mantenere almeno:

- backend;
- hotel scope;
- source kind/id;
- canonical reference;
- validFrom/validUntil quando esistono;
- observedAt/lastVerifiedAt quando esiste;
- confidence/score;
- indicazione se è una proiezione ricostruibile.

Il modello non deve ricevere una frase recuperata senza sapere da quale fonte canonica deriva.

## Connessione con Gruppo 1

Se Graphiti o LightRAG vengono esposti come tool, la lista dei tool deve passare prima dal RandTool Gateway. Il Knowledge Gateway non sostituisce l'autorizzazione del Gruppo 1: la restringe per il dominio knowledge.

Il tracing usa `traceRandAIOperation('knowledge.query', ...)`, quindi Phoenix o qualunque backend OTLP compatibile potrà osservare latency/errori senza diventare proprietario dei log.

## Connessione con Gruppo 3

Mastra/Trigger.dev o qualunque runtime durevole non potranno conservare un vecchio contesto autorizzativo. Alla ripresa di un workflow dovranno rivalidare identità, hotel e scope e rifare il knowledge lookup attraverso questo gateway prima di decisioni o mutazioni.

## Security e privacy

- nessun secret negli indici;
- niente service role nel browser o nei motori esterni;
- nessun cross-hotel retrieval;
- nessuna projection equivale a autorizzazione;
- ingestion bounded alle fonti già autorizzate;
- cancellazione/forgetting canonico deve propagarsi alle proiezioni mediante invalidazione/rebuild;
- un indice stale/unknown non può essere dichiarato healthy.

## Zombie policy

Nessun componente RandMind viene rimosso: `memory/engine`, `MemoryStore`, contratti, production gate e console sono tutti ancora proprietari di funzioni vive e testate.

Graphiti e LightRAG non introducono store canonici paralleli, quindi non nasce nuovo debito zombie nel browser. Quando verranno attivati come servizi, ogni adapter dovrà avere health, kill switch, version pin e rebuild procedure.

## Test

```bash
npm run test:randmind
npm run test:group1
npm run test:group2
```

Il workflow `.github/workflows/randai-group2-knowledge.yml` esegue insieme memoria canonica, boundary tool e boundary knowledge per bloccare regressioni tra i gruppi.

## Criterio di completamento

Il Gruppo 2 è completo a livello repository quando:

- ownership Supabase/RandMind/Graph/RAG è esplicita;
- knowledge query è fail-closed su identità/hotel/scope;
- provenance e temporal validity sono obbligatorie;
- projection rows invalide non raggiungono RandAI;
- fallback RandMind funziona se gli indici esterni sono indisponibili;
- Group 1 e RandMind continuano a passare;
- CI completa e device/browser gates non regrediscono;
- README documenta il nuovo boundary.
