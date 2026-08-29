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
- 12 tabelle senza policy sono intenzionalmente interne e, dopo hardening, risultano accessibili solo a `service_role`.
- le policy operative principali sono hotel-scoped tramite `has_app_permission`, `is_hotel_member` o `can_admin_hotel`.
- Storage `maintenance-photos` usa il primo segmento del path come `hotel_id` e applica membership/ownership.

### Prove RLS reali
Sono stati impersonati utenti autenticati monohotel tramite claim JWT in transazioni rollback-only:
- Hotel Giò: membership Giò=true, Choco/Brigantino=false; camere Giò visibili, altre strutture=0.
- Chocohotel: membership Choco=true, Giò/Brigantino=false; segnalazioni delle altre strutture=0.
- Brigantino: membership Brigantino=true, Giò/Choco=false.
- Storage con utente Giò: oggetti Giò visibili, Choco/Brigantino=0.

### Hardening applicato
Migrazione Supabase `20260829213501_roadmap20_rls_privilege_and_fk_hardening`:
- revocati i privilegi client diretti da `randai_credentials` e `randai_hvac_zones`; entrambe restano service-only;
- aggiunti indici FK su `equipment_id` per `randai_documents`, `randai_memory`, `randai_sensor_bindings`.
- migrazione sincronizzata in `supabase/migrations/20260829213501_roadmap20_rls_privilege_and_fk_hardening.sql`.

### Advisor classificati, non ignorati
- `RLS enabled no policy`: intenzionale sulle 12 tabelle service-only; verificato che non abbiano grant `anon`/`authenticated`.
- `SECURITY DEFINER executable by authenticated`: le funzioni client esposte verificate usano `auth.uid()` e controlli hotel/permesso e hanno `search_path` fissato. L'eventuale riduzione ulteriore della superficie RPC viene riesaminata al punto 21 con threat model Auth/Ruoli.
- `Leaked Password Protection Disabled`: setting Auth da affrontare nel punto 21.
- `Multiple permissive policies` RandAI e indici storicamente non usati: ottimizzazione da trattare senza rimozioni cieche nel punto 26/performance.

## Prossimo
Punto 21 — Auth, Ruoli & Threat Model.
