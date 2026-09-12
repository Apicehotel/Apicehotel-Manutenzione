# RandResearch v1

## Ownership
RandResearch è l'owner canonico della ricerca approfondita, non del web, della memoria o dell'autorizzazione. Riusa RandKnowledge per retrieval autorizzato, RandMind per memoria verificata, RandCore/Durable per lifecycle e RandAudit/RandGovernance per promotion e decision evidence.

## Pipeline
`request → authorize → canonical query → L0-L4 plan → internal knowledge + source adapter → normalize/score → contradiction + gap analysis → synthesize → ship gate → human review (L3/L4)`

## Livelli
- L0: lookup bounded, 1 query / 3 fonti.
- L1: verifica breve, 3 query / 8 fonti.
- L2: ricerca standard, 6 query / 20 fonti + critic gate.
- L3: ricerca profonda, 12 query / 50 fonti + human review.
- L4: audit, 24 query / 120 fonti, almeno 2 fonti di alta qualità, citazioni complete + human review.

I budget sono tetti, non obiettivi di consumo: il coordinator può fermarsi prima quando l'evidenza è sufficiente.

## Evidence model
Ogni fonte richiede `source.id/kind/uri`, hotel, titolo, excerpt, tier, fetchedAt e segnali di qualità. Il punteggio combina tier, directness, recency, corroboration e retrieval confidence. Nessun punteggio trasforma una fonte in verità: serve a ordinare evidenze e rendere spiegabile il report.

## Security
- actor + hotel obbligatori;
- scope `research:execute` e `knowledge:read` obbligatori;
- cross-hotel denied nel coordinator, runtime e DB trigger;
- fonti con prompt-injection risk o retraction risk bloccano lo ship gate;
- il testo delle fonti è dati e non può diventare istruzione/tool call;
- persistence server-side service-role-only;
- nessuna API key/provider secret entra nel PWA.

## Contradictions e gaps
Claim con stessa chiave e valori discordanti generano contradiction evidence. Due fonti di buona qualità in disaccordo producono HIGH e bloccano lo ship gate finché una risoluzione non cita evidenza presente nella sessione. I requirements non coperti diventano gap; L2-L4 non possono essere READY con gap aperti.

## RandRadar
Hyperresearch (MIT) è `ADOPT PATTERNS / NON INSTALLARE`: canonical query persistente, tier adattivi, critic/audit, provenance, resume e source scoring sono pattern utili; il runtime Python/Claude Code duplicherebbe RandCore e il nostro model/tool stack. Agentic Wiki/LLM-Wiki restano `SOURCE ONLY`: il principio fonte canonica + indice ricostruibile è utile, ma non introduciamo un secondo knowledge store.

## Connessioni future
Punto 6: HITL consuma `requiresHumanReview` e ship gate per approvare ricerche L3/L4 o risolvere contraddizioni.
Punto 7: RandMCP/Gateway può fornire adapter di ricerca/fetch, sempre dietro authorization e tool gateway.
RandMind: soltanto outcome di ricerca approvati e convertiti in un `ACTION_OUTCOME` verificato possono diventare memoria VERIFIED; RandResearch non scrive direttamente verità in memoria.
