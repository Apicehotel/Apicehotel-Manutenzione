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
- le policy operative principali sono hotel-scoped tramite `has_app_permission`, `is_hotel_member` o `can_admin_hotel`.
- Storage `maintenance-photos` usa il primo segmento del path come `hotel_id` e applica membership/ownership.
- prove reali con ruolo `authenticated` hanno confermato isolamento Giò/Choco/Brigantino.

### Hardening applicato
- `20260829213501_roadmap20_rls_privilege_and_fk_hardening`;
- `20260829215548_roadmap20_rls_performance_followup`;
- `20260829215654_roadmap20_randai_relational_isolation`.

Le FK RandAI critiche sono composite con `hotel_id`; gli advisor RLS `auth_rls_initplan` e `multiple_permissive_policies` sono stati eliminati senza indebolire l'autorizzazione.

## Punto 21 — Auth, Ruoli & Threat Model — COMPLETE

### Identità e PIN
- 0 PIN legacy in chiaro; 34 credenziali PIN bcrypt presenti nel boundary dedicato.
- `pin-auth` esclude RandAI, verifica membership attiva e applica lockout.
- `user-pin` richiede ora sempre il PIN corrente per cambiare il proprio PIN: una sessione autenticata rubata non basta più da sola a sostituire la credenziale.
- Admin protetto: PIN 6 cifre bcrypt, throttling e identità `Randagio` protetta.
- PIN recovery: risposta uniforme, token hashato, scadenza breve e rate limit ora atomico lato Postgres con row lock.

### Ruoli e privilege escalation
- `RandAI` è separato da RandApp Admin: `can_admin_hotel` lo rifiuta esplicitamente; `can_manage_randai_hotel` governa soltanto il perimetro RandAI.
- 9 membership RandAI verificate senza anomalie; nessuna identità/membership orfana; un solo profilo di sistema protetto e relative membership tutte `admin`.
- `profiles`, `hotel_memberships` e `utenti` sono diventate read-only dal browser per `authenticated`: INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER sono revocati. Le mutazioni identità/ruoli passano soltanto dai boundary server-side `admin-users`, `user-pin`, `admin-gate` e `randai-auth`.
- questo elimina la possibilità di auto-riattivarsi, impostarsi `is_system_protected`, cambiare `legacy_user_id` o sfruttare direttamente policy parzialmente hotel-scoped per aumentare i privilegi.

### Edge Functions e trust boundary
- le funzioni privilegiate con `verify_jwt=true` ricostruiscono l'utente con `auth.getUser()` e verificano membership/ruolo prima delle operazioni service-role esaminate.
- le funzioni pubbliche `verify_jwt=false` restano solo dove esiste un meccanismo di trust esplicito: PIN custom + lockout, token capability, firma Twilio o secret cron/sync.
- `setup-whatsapp-template` richiede l'Admin di sistema protetto su tutte e tre le strutture prima di usare credenziali Twilio.

### Gate permanente
- `test/point21-auth-threat-model.test.js` verifica separazione RandAI/Admin, read-only identity authority, prova del PIN corrente e rate limit recovery atomico.
- il test è incluso nel Critical Operational Gate.

### Residuo piattaforma
- Supabase Auth segnala `Leaked Password Protection Disabled`. Il connettore disponibile non espone la modifica di questa impostazione Auth; va abilitata dal Dashboard Supabase quando disponibile. I PIN umani RandApp sono gestiti dal sistema custom bcrypt e le password Supabase interne vengono randomizzate, quindi questo residuo è defense-in-depth e non annulla la certificazione del flusso PIN.

## Prossimo
Punto 22 — E2E + Visual Regression.
