# RandApp certification roadmap status

Branch di lavoro: `chore/randapp-agent-toolchain`.

## Punto 19 — Dependency & Code Quality Audit — COMPLETE

Gate permanenti aggiunti:
- `npm run test:dependencies`: dipendenze dichiarate/import effettivi; distingue runtime Node/Vite da Deno/Supabase.
- `npm run test:code-health`: merge markers, `debugger`, sorgenti patologicamente grandi e hotspot.
- entrambi i gate sono eseguiti dalla CI prima di build/test browser.

Evidenza di chiusura:
- `npm audit --audit-level=high` verde;
- dependency usage audit verde;
- source health audit verde;
- quality matrix e critical operational gate verdi;
- build e bundle budget verdi;
- unit/contract suite verde;
- Playwright Chromium + WebKit, cross-platform browser gate e device acceptance verdi.

## Punto 20 — Supabase & RLS Audit — COMPLETE

Progetto verificato: `Apice MultiHotel` (`ooqlfldcrnkudhgjnied`).

### RLS e isolamento
- 54/54 tabelle `public` con RLS abilitato; 0 con RLS disabilitato.
- 0 tabelle `public` con DML diretto concesso ad `anon`.
- 42 tabelle client-facing hanno policy RLS.
- le tabelle senza policy sono intenzionalmente interne e risultano senza grant browser diretti.
- le policy operative principali sono hotel-scoped tramite `has_app_permission`, `is_hotel_member` o `can_admin_hotel`.
- Storage `maintenance-photos` usa il primo segmento del path come `hotel_id` e applica membership/ownership.

### Prove RLS reali
Sono stati impersonati utenti autenticati monohotel tramite claim JWT:
- Hotel Giò: membership Giò=true, Choco/Brigantino=false.
- Brigantino: membership Brigantino=true, Giò/Choco=false; sulle righe operative presenti sono risultate visibili 2 righe Brigantino e 0 Giò/Choco.
- i controlli sono stati eseguiti con il ruolo `authenticated`, quindi attraverso le policy RLS effettive e non come service role.

### Hardening applicato
Migrazione Supabase `20260829213501_roadmap20_rls_privilege_and_fk_hardening`:
- revocati i privilegi client diretti da `randai_credentials` e `randai_hvac_zones`;
- aggiunti gli indici iniziali sulle FK RandAI.

Migrazione Supabase `20260829215548_roadmap20_rls_performance_followup`:
- le policy admin di `utenti` usano `(select auth.uid())`, eliminando la rivalutazione per-riga segnalata dall'advisor;
- eliminate le doppie policy permissive SELECT RandAI;
- sostituite con una sola policy SELECT per tabella e policy INSERT/UPDATE/DELETE separate, mantenendo accesso manager e lettura operativa dei membri.
- dopo la migrazione sono scomparsi gli advisor WARN `auth_rls_initplan` e `multiple_permissive_policies`.

Migrazione Supabase `20260829215654_roadmap20_randai_relational_isolation`:
- prima del cambio sono stati verificati 0 riferimenti cross-hotel esistenti;
- introdotte chiavi/indici compositi `(id, hotel_id)` e FK composite per documenti, procedure, memoria, binding ed estratti documentali RandAI;
- un record RandAI non può più riferirsi a un parent di un altro hotel anche se il frontend viene bypassato.

### Advisor classificati, non ignorati
- `RLS enabled no policy`: intenzionale per tabelle service-only senza grant `anon`/`authenticated`.
- `SECURITY DEFINER executable by authenticated`: le RPC/helper client esposte hanno `search_path` fissato e controlli hotel/permesso; la riduzione ulteriore della superficie RPC viene trattata nel punto 21.
- `Leaked Password Protection Disabled`: setting Auth da affrontare nel punto 21.
- gli `unused_index` restano INFO: non vengono rimossi sulla sola base di statistiche di utilizzo ancora giovani.
- `sensori_temperatura` non espone attualmente `hotel_id`: il legame `randai_sensor_bindings.device_id` non può ancora diventare una FK composita; resta un limite architetturale da verificare nel punto 21/25.

## Prossimo
Punto 21 — Auth, Ruoli & Threat Model.
