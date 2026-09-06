# RandSkills Router — Blocco 1

Questo blocco trasforma RandSkills da catalogo governato a router operativo senza creare un secondo executor o un secondo sistema permessi.

## Flusso

`objective -> RandSkillRouter -> skill APPROVED -> permission/tool requirements -> caller authorization intersection -> risk bound -> RandAgentRuntime`

## Invarianti

- RandCore/RLS/RPC restano autorità finale.
- Il router può solo restringere i tool già autorizzati; non può concederne di nuovi.
- Ogni skill canonica dichiara permissions, requiredTools, instructions e successCriteria runtime.
- `requiredTools` supporta pattern governati e ancorati (es. `maintenance.*`).
- Intenti non riconosciuti producono `FALLBACK` fail-closed.
- Il routing esplicito accetta solo skill `APPROVED`.
- Il routing implicito restituisce confidence, motivazioni e può comporre più skill.
- Il cognitive loop mantiene `hotelId` obbligatorio e passa al runtime solo skill/tool bounded.

## Routing iniziale

Le sette skill canoniche sono: maintenance, housekeeping, planning, warehouse, whatsapp, procedures, repo-radar.

Il router usa metadati dichiarativi versionati. Esempi coperti dai regression test:

- lampadina/guasto/intervento -> maintenance;
- guasto + ricambio/magazzino -> maintenance + warehouse;
- repository/GitHub/dipendenza -> repo-radar;
- intento estraneo -> FALLBACK;
- skill esplicita APPROVED -> routing deterministico.

## Tool binding

Il binding è a doppio limite:

1. il chiamante fornisce `allowedToolIds` già autorizzati;
2. le skill selezionate dichiarano `requiredToolPatterns`;
3. viene calcolata l'intersezione;
4. `ToolsetResolver` applica infine `maxToolRisk`.

Un pattern skill non può quindi trasformarsi in autorizzazione.

## Evidence

Ogni decisione include `mode`, `confidence`, `skillIds`, `requiredPermissions`, `requiredToolPatterns`, `matches/reasons` e `fallbackRequired`. Questi dati vengono inseriti nel contesto RandMind e possono essere auditati e usati dai gate futuri di observability/learning.

## Zombie scan

Nessun registry o runtime preesistente viene duplicato. `SkillRegistry`, `ToolRegistry`, `ToolsetResolver`, `RandAgentRuntime` e `LearningEngine` restano i proprietari canonici. Il vecchio `SkillRegistry.discover()` resta disponibile per compatibilità interna ma non è più il router del cognitive loop.

## Gate

Il regression test dedicato è `test/randskills-router-block1.test.js`; inoltre `npm test` lo include automaticamente insieme ai test RandSkills/RandMind esistenti.
