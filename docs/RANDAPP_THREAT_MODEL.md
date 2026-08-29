# RandApp Threat Model

Scope: `Apicehotel/Apicehotel-Manutenzione`, roadmap point 21.

## Assets
- hotel-scoped operational data for Hotel Giò, Chocohotel and Brigantino;
- maintenance and completion photos;
- user identity, memberships, roles and permission matrix;
- PIN credentials and protected Admin identity;
- RandAI credentials, knowledge, documents and equipment;
- Twilio/WhatsApp, ntfy, eWeLink and cron secrets;
- technician capability tokens;
- Supabase service-role authority.

## Trust boundaries
1. Browser/PWA (untrusted client) → Supabase Auth / Edge Functions.
2. Authenticated session → Postgres/PostgREST RLS.
3. Browser → Storage policies for `maintenance-photos`.
4. Edge Functions → service-role Postgres/Storage.
5. External Twilio webhook → `whatsapp-webhook` signature validation.
6. Cron/sync callers → workers protected by dedicated server-side secrets.
7. Public technician links → capability-token boundary.
8. RandAI session → dedicated RandAI management boundary; never equivalent to RandApp Admin.
9. Server-side integrations → Twilio, ntfy, eWeLink and AI providers.

## Primary attacker classes
- unauthenticated Internet caller;
- authenticated employee attempting cross-hotel access;
- compromised low-privilege employee session;
- compromised RandAI credential;
- holder of a leaked technician/public capability link;
- forged webhook/cron request;
- compromised browser attempting direct PostgREST calls bypassing frontend guards.

## High-value abuse paths and controls

### PIN brute force
Risk: 4-digit user PINs and 6-digit protected Admin PIN are small keyspaces.
Controls: bcrypt credentials, persistent failed-attempt counters for user PINs, 5-attempt/10-minute Admin throttling keyed by privacy-preserving source hash, progressive delay, no plaintext fallback for migrated users.

### Public directory enumeration
Risk: pre-login account directory leaking contact/presence/admin metadata.
Control: `pin-auth` public directory returns only login-selection fields and excludes RandAI identities.

### Protected Admin escalation
Risk: custom Admin PIN endpoint returns a full Supabase session.
Controls: throttling, bcrypt, protected profile, three-hotel admin memberships, authenticated protected-admin requirement for PIN changes.

### RandAI privilege confusion
Risk: historical `can_access_admin` flag conflated Control Center access with RandApp administration.
Controls: `can_admin_hotel` explicitly rejects role RandAI; `can_manage_randai_hotel` is separate; RandAI role permissions are read-only outside dedicated RandAI tables; `admin-users` rejects RandAI for mutations; direct RLS bypasses on app config/role permissions/users were removed.

### Cross-hotel data access
Risk: authenticated user changes `hotel_id` or calls PostgREST directly.
Controls: RLS is server-side authority; hotel-scoped membership/permission helpers; explicit negative RLS tests for Giò/Choco/Brigantino; Storage path hotel scope; sensor visibility now follows explicit membership and hotel visibility flags.

### Twilio service credential abuse
Risk: public function using service-side Twilio credentials.
Control: `setup-whatsapp-template` requires JWT plus protected multi-hotel Admin verification. `whatsapp-webhook` remains public only because it verifies Twilio request signatures.

### Recovery email abuse / enumeration
Risk: repeated recovery requests or email existence oracle.
Controls: feature flag, uniform responses, source+email hashed rate limit (3 per 30 minutes), minimum response timing, short-lived recovery request.

### Public/worker Edge Functions
`verify_jwt=false` is accepted only for a documented custom trust mechanism:
- `pin-auth`: bcrypt PIN custom authentication + lockout;
- `admin-gate`: protected Admin PIN + throttling;
- `pin-recovery`: public recovery semantics + rate limiting;
- `randai-auth`: bcrypt RandAI credential + lockout;
- `tech-portal`: high-entropy technician capability token + assignment checks;
- `public-iss`: intentionally public read-only UUID share surface with bounded output;
- `whatsapp-webhook`: Twilio signature;
- `sync-sensori-temperatura`: `x-sync-secret`;
- `urgent-reminder-worker`, `reminder-worker`, `weather-alert-worker`: dedicated cron secret.
Any new unauthenticated service-role Edge Function is a release blocker until an explicit trust mechanism is documented and tested.

## Security invariants
- frontend visibility is never authorization;
- RandAI is not RandApp Admin;
- no hotel membership implies no hotel data;
- a membership for hotel A cannot authorize hotel B;
- anonymous callers never receive direct DML on public application tables;
- service-only tables have RLS enabled and no `anon`/`authenticated` grants;
- no migrated user PIN is stored in plaintext;
- secrets remain server-side and are never returned by diagnostics or public endpoints.

## Residual platform setting
Supabase Auth advisor reports Leaked Password Protection disabled. The connected management surface used for this audit does not expose Auth configuration mutation. Enable the setting in the Supabase Dashboard when available. RandApp human PIN authentication is custom and internal Supabase passwords are random, but the platform-level protection should still be enabled for defense in depth.
