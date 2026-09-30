# RandSkills Unified Manager

RandSkills Unified Manager è la vista amministrativa unica per skill e MCP dell'ecosistema Rand.

## Fonti canoniche

Non mantiene una seconda copia dei dati:

- skill: `canonicalRandSkillDefinitions()` / `rand-skills/*/SKILL.md`;
- MCP: `config/mcp/registry.json`;
- agenti/moduli: `RAND_ECOSYSTEM_COMPONENTS`;
- stato MCP live: `rand-capability-broker` con capability `broker.status`.

Il catalogo unificato è quindi una **proiezione**, non un nuovo authority store.

## UI

Percorso:

`Amministrazione RandAI -> Skill & MCP`

La pagina mostra:

- conteggio skill;
- conteggio MCP;
- profili MCP;
- MCP abilitati live;
- versione catalogo skill e registry MCP;
- sorgente, governance, permessi, tool/capability e profili;
- ricerca e filtri per skill/MCP/profilo.

## Sicurezza

La presenza nel catalogo non concede esecuzione.

- una skill resta soggetta a `SkillRegistry`, router, ToolRegistry e permission gateway;
- un MCP resta soggetto a `allowedToolIds`, broker server-side, allowlist, hotel membership e RandCore;
- scritture operative restano esclusivamente RandGateway/RLS/HITL;
- `broker.status` espone solo stato/configurazione, mai token o secret;
- uno stato MCP `REGISTERED` non significa connesso o sano.

## Pattern adottati da Skills Manager

Da `xingkongliang/skills-manager` vengono adottati come pattern:

- libreria centrale;
- distinzione tra presenza nel catalogo e deploy/abilitazione;
- profili/preset;
- sorgente e stato visibili;
- inventario verificabile dagli agenti;
- aggiornamenti e deployment governati, mai scrittura diretta nelle cartelle/tool.

Non vengono importati Tauri, Rust, SQLite o il runtime desktop: Rand resta su React/Supabase/RandCore.

## Gate

```bash
npm run test:randskills
npm run test:randui
npm run build
npm run test:e2e
npm run test:device
```
