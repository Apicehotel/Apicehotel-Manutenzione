# RandRadar — Policy di ricerca multi-sorgente

## Regola permanente

RandRadar non deve limitarsi a GitHub o a un piccolo gruppo di portali. Per ogni ricerca di repository, plugin, MCP, librerie, design system, tool AI, componenti UI o infrastruttura deve eseguire una scansione multi-sorgente prima di classificare i candidati.

### Copertura minima

Per ogni scansione significativa, RandRadar deve cercare su almeno 8 ecosistemi differenti quando pertinenti. Il runtime automatico usa attualmente **8 provider**: GitHub, GitLab, Codeberg, Gitee, npm, crates.io, Hugging Face e Open VSX.

Il deep review può e deve allargarsi anche a:

- GitCode
- Bitbucket
- SourceForge
- PyPI
- pub.dev
- Maven Central / MVN Repository
- NuGet
- Docker Hub
- VS Code Marketplace
- Figma Community
- registri MCP (es. MCP.so, Glama, Smithery e altri disponibili)
- Storybook / design-system showcase
- Replit, StackBlitz, CodeSandbox e altri ambienti pubblici quando contengono sorgenti o demo rilevanti

L’elenco è estensibile: la presenza di una sorgente nuova o più adatta deve ampliare la ricerca, non sostituire automaticamente le altre. GitHub è una sorgente, non “la rete”.

## Regola di profondità

La ricerca non deve fermarsi ai primi risultati. Deve:

1. usare più query equivalenti e sinonimi;
2. cercare sia il nome della tecnologia sia la funzione (es. `Figma MCP`, `design-to-code`, `code-to-Figma`, `design tokens`, `visual regression`, `plugin API`);
3. verificare registri di pacchetti oltre ai repository di codice;
4. cercare mirror, fork e fork attivi solo per individuare evoluzioni significative, eliminando i duplicati dal risultato finale;
5. verificare attività recente, release, issue, licenza, dipendenze, sicurezza e compatibilità con Rand;
6. distinguere progetto originale, fork, mirror, wrapper e semplice demo;
7. preferire fonti primarie e documentazione ufficiale quando disponibili.

## Filtro qualità

RandRadar deve scartare o declassare:

- mirror puri senza valore aggiunto;
- fork non mantenuti;
- repository abbandonati quando esistono alternative moderne;
- demo prive di codice o documentazione sufficiente;
- progetti con provenienza non verificabile;
- duplicati dello stesso progetto pubblicati su registri diversi.

I candidati validi vanno classificati come:

- **AGGIUNGI** — utile da adottare, integrare o mantenere come riferimento permanente;
- **SOSTITUISCI** — può rimpiazzare una soluzione Rand esistente con vantaggi concreti;
- **IGNORA** — non porta beneficio sufficiente, è ridondante o presenta rischi non giustificati.

Ogni classificazione deve includere motivazione, benefici, rischi, maturità, attività/manutenzione, sicurezza, licenza, compatibilità, impatto sulle dipendenze e destinazione nell’ecosistema Rand.

## Licenze e contesto Rand

La versione attuale di RandApp/RandAI è interna e non commerciale. GPL/AGPL non sono motivi automatici di esclusione. RandRadar distingue tra:

- `REFERENCE_ONLY` / studio dei pattern;
- `INTERNAL_EVALUATION`;
- `SEPARATE_SERVICE`;
- `DIRECT_INTEGRATION`.

Le licenze copyleft restano in `WATCH` finché il boundary d'uso non è esplicito e la review licenza non è approvata. Questo evita sia il rifiuto automatico sia l'adozione cieca. In caso di futura distribuzione pubblica/commerciale o accesso via rete, gli obblighi vanno rivalutati.

## Regola per ricerche Figma / UI

Per Figma e design-to-code, la scansione deve coprire almeno queste famiglie:

- Figma → code;
- code / HTML / URL → Figma;
- screenshot → Figma layers;
- MCP / agent bridge;
- design token sync;
- variables / components / Dev Mode / codegen;
- Storybook ↔ Figma;
- visual regression contro design Figma;
- Flutter / React / React Native / SwiftUI / Web Components;
- accessibilità e design-system linting.

Le famiglie sono anche codificate in `src/randai/discovery/repo-radar-sources.js`, così non possono sparire silenziosamente dalla discovery.

## Output

Per richieste ampie, RandRadar deve prima raccogliere un insieme più grande di candidati, deduplicarlo e poi presentare la shortlist realmente utile. Non deve dichiarare una ricerca “approfondita” se ha controllato solo pochi siti o un solo ecosistema.

## Governance

Questa policy è una regola permanente di RandRadar. Modifiche future devono passare da branch dedicata + Pull Request e revisione umana; nessun agente deve modificare `main` direttamente.
