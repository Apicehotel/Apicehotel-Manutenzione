# RandSkills v1

RandSkills è il catalogo versionato delle competenze operative usate da RandAI/RandMind. Adotta il formato aperto Agent Skills: ogni skill vive in una cartella e contiene almeno `SKILL.md` con frontmatter `name` e `description`.

## Principi

- Una skill descrive una competenza, non sostituisce RLS/RPC, permessi o audit.
- RandCore resta l'autorità per autorizzazione, hotel scope, safe write e azioni critiche.
- Le skill non contengono secret, UUID di produzione o credenziali.
- Le skill sono caricate solo quando pertinenti; niente prompt monolitico.
- Le modifiche ad alto rischio richiedono test e approvazione; l'apprendimento futuro può proporre miglioramenti ma non bypassare RandCore.
- Le capacità già esistenti in RandApp vanno riusate: niente secondo sistema per procedure, magazzino, housekeeping, planning o Repo Radar.

## Struttura

```text
rand-skills/
  _template/SKILL.md
  maintenance/SKILL.md
  housekeeping/SKILL.md
  planning/SKILL.md
  warehouse/SKILL.md
  whatsapp/SKILL.md
  procedures/SKILL.md
  repo-radar/SKILL.md
```

## Contratto Rand

Ogni `SKILL.md` deve contenere:

1. frontmatter `name` e `description`;
2. Scope;
3. Permissions;
4. Allowed actions;
5. Forbidden actions;
6. Workflow;
7. Validation.

Le skill operative devono dichiarare che `hotel_id` è obbligatorio quando accedono a dati hotel-scoped.

## Toolchain

La versione Node canonica è `.nvmrc`. `package.json`, npm e i workflow CI devono restare coerenti con quel file. `engine-strict=true` fa fallire l'installazione su una major non supportata.

## Validazione

`npm run skills:validate` valida struttura, nomi, sezioni obbligatorie e coerenza del catalogo. `npm run test:randskills` esegue il contratto automatico del blocco.

## Evoluzione prevista

Blocco 2 collegherà RandSkills a RandMind/RandTools/RandMemory. Il formato resta vendor-neutral, così Anthropic Skills è un riferimento di standard e non una dipendenza centrale.
