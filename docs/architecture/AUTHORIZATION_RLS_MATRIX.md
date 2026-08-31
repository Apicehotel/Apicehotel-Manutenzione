# Authorization & RLS Verification Matrix — Reliability Block 37

## Obiettivo

Il Blocco 37 non introduce un secondo motore permessi. Mantiene **KEEP** `src/permissions.js`, `has_app_permission(...)`, membership, Action Gateway e Supabase RLS come autorità, ma rende verificabile il contratto `hotel × ruolo × modulo × azione × ownership` e applica least privilege ai grant database.

## Decisione architetturale

`UI/Context Guard → permissions.js → RPC/data layer → PostgreSQL grants → RLS policy → row`

Il frontend decide cosa mostrare e blocca presto gli errori evidenti; non è autorità. I grant PostgreSQL stabiliscono quali classi di operazioni può tentare il ruolo client. Le RLS verificano hotel, ruolo/permesso e ownership sulla singola riga.

### KEEP

- permission model e `role_permissions` esistenti;
- `has_app_permission`, `is_hotel_member`, `has_hotel_role`, `can_admin_hotel`;
- ownership speciale delle Segnalazioni: chi crea può cancellare la propria, mentre ruoli con `issues.delete` possono cancellare secondo policy;
- Action Gateway RandAI e Context & Scope Guard come preflight, non come sostituti RLS.

### UPGRADE

- tutte le policy `public` nello schema `public` vengono ristrette a `authenticated`, senza cambiare `USING` o `WITH CHECK`;
- `anon` e `authenticated` perdono `TRUNCATE`, `TRIGGER`, `REFERENCES` sulle tabelle `public` perché RandApp non ne ha bisogno;
- RPC mutative `SECURITY DEFINER` sensibili devono avere grant di esecuzione espliciti: `inventory_adjust_stock(uuid,numeric,text)` è revocata a `PUBLIC/anon` e concessa solo a `authenticated`;
- una funzione di assertion server-side verifica il baseline e fa fallire la migrazione se il contratto non è rispettato.

### NO ADD / DEFER

OPA/Casbin non vengono aggiunti: introdurrebbero una seconda sorgente di verità da sincronizzare con Supabase. Il benchmark esterno conferma invece deny-by-default, least privilege, verifica su ogni richiesta e test allow/deny come principi da applicare al sistema già presente.

## Matrice critica automatizzata

Per queste tabelle il baseline richiede RLS attivo e policy `authenticated` per `SELECT`, `INSERT`, `UPDATE`, `DELETE`:

- `segnalazioni`
- `maintenance_issues`
- `interventi`
- `richieste_urgenti`
- `planning_lavori`
- `planning_lavori_giorni`
- `prenotazioni_sale`
- `inventory_items`
- `camere_giorno`
- `camere_lavoro`
- `import_camere`
- `tecnici`

La funzione `public.assert_randapp_authorization_baseline()` verifica inoltre che nessuna policy nello schema `public` sia rivolta a `PUBLIC`, che `anon/authenticated` non abbiano privilegi `TRUNCATE`, `TRIGGER`, `REFERENCES` e che l'RPC mutativa di Magazzino non sia eseguibile da `anon` ma resti eseguibile da `authenticated`. L'esecuzione dell'assertion è revocata a `PUBLIC` ed esposta solo a `service_role`.

## Security advisor

Dopo l'applicazione della prima migrazione del Blocco 37 viene eseguito il security advisor Supabase. Gli avvisi `RLS Enabled No Policy` sulle tabelle service-only rappresentano deny-all intenzionale e non richiedono policy browser. Gli helper `SECURITY DEFINER` eseguiti da `authenticated` sono mantenuti quando servono alle policy/RPC e devono continuare a verificare hotel/permessi internamente. Un warning su `inventory_adjust_stock` eseguibile da `anon` è stato invece classificato come vulnerabilità reale e corretto con la migrazione follow-up `20260901015200_block37_inventory_rpc_execute_hardening.sql`.

## Ownership e multi-hotel

Il Blocco 37 non appiattisce ownership e ruoli in una tabella generica. Le policy esistenti continuano a esprimere le regole specifiche del dominio. In particolare il filtro `hotel_id` deve essere sempre parte della decisione server-side tramite helper di membership/permission; test cross-hotel e negative path restano obbligatori.

## Definition of Done

Il blocco è completato solo quando:

1. migrazioni e test sono nel repository;
2. il baseline fallisce chiuso se il contratto non è valido;
3. le RPC mutative `SECURITY DEFINER` sensibili non sono eseguibili anonimamente;
4. CI completa, multi-hotel e device gate sono verdi;
5. README e documento architetturale sono allineati;
6. le migrazioni risultano applicabili allo schema Supabase reale senza introdurre un secondo permission engine;
7. il security advisor post-deploy non segnala più l'RPC Magazzino come anon-executable.
