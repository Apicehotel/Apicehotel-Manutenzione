# RandAI UI Foundation v1

## Obiettivo

Evolvere l'interfaccia di RandAI senza creare un secondo design system e senza cambiare i confini di sicurezza già consolidati.

## Proprietario canonico

**RandUI resta l'unico proprietario UI dell'ecosistema.** RandAI usa React 19 + Vite 7 e i token, layout, density contract e guard già presenti in RandUI. Nessuna libreria esterna può introdurre un secondo owner di navigazione, tema, responsive, accessibilità o componenti fondamentali.

Le due superfici restano intenzionalmente separate:

- `chat-page`: pagina chat dedicata autenticata dentro RandApp (tab RandAI + header);
- `control-center`: pagina completa e protetta `/randai`.

Condividono linguaggio visuale e primitive, ma non vengono fuse in una singola schermata.

## Primitive AI native

Il contratto `src/randai/ui/ai-surface-contract.js` definisce otto primitive: `conversation`, `message`, `source`, `status`, `reasoning`, `plan`, `tool`, `composer`.

Queste primitive descrivono capacità UI; non concedono permessi, non eseguono tool e non modificano il gateway. Tool call e azioni operative continuano a passare da RandGateway → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit.

## RandRadar: decisioni sulle fonti UI

| Fonte | Decisione | Motivo |
| --- | --- | --- |
| `vercel/ai-elements` | `ADOPT_PATTERN` | Ottimi pattern AI, ma l'adozione diretta porterebbe shadcn/Tailwind nel runtime React/Vite attuale e creerebbe un secondo sistema UI. |
| `crafter-station/elements` | `SOURCE_ONLY` | Catalogo utile per pattern specifici; i blocchi vengono valutati singolarmente, non installati come framework. |
| `fantastic-admin/basic` | `LAYOUT_REFERENCE` | Buon riferimento per shell/admin, ma basato su Vue e quindi incompatibile come dipendenza RandApp. |
| `abuanwar072/E-commerce-Complete-Flutter-UI` | `MOBILE_REFERENCE` | Utile per stati mobile, error/empty state e navigazione; Flutter non entra nello stack web. |

Regola di adozione: **RandUI esistente → adattamento di un pattern esterno → componente nativo nuovo**. Una dipendenza esterna entra solo se riduce davvero complessità, supera Quality Matrix e non duplica un owner esistente.

## Zombie policy

`src/randapp/randui-v2/` non è zombie al momento della fondazione v1: `/ui-v2-preview` lo usa ancora come candidato verificabile nel workflow Ocean. Verrà rimosso soltanto quando il gate preview verrà sostituito e non esisteranno più referenze runtime/CI.

## Compatibilità futura

La fondazione è volutamente dependency-free. In futuro le primitive possono ricevere implementazioni più ricche (streaming reasoning, plan progressivo, tool state, source cards, allegati/PDF) mantenendo invariati:

1. RandUI come owner visuale;
2. autorizzazione e hotel scope lato RandCore/Supabase;
3. RandGateway come unico confine delle azioni;
4. popup rapido e Control Center come superfici distinte;
5. CI/browser/device gate prima di qualsiasi promozione.
