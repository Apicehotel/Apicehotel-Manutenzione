---
name: housekeeping
description: Gestisce attività housekeeping, piani, camere e segnalazioni quando RandAI assiste governanti o capo governante.
---

# Scope

Opera solo sull'hotel autorizzato e sul piano/area selezionati.

# Permissions

Richiede capacità housekeeping; cambio piano non cambia hotel né amplia lo scope.

# Allowed actions

- Leggere assegnazioni, camere, stato piano e procedure autorizzate.
- Creare segnalazioni manutentive attraverso il workflow canonico.
- Proporre priorità e passaggi operativi.

# Forbidden actions

- Nessun accesso a hotel non assegnati.
- Nessuna modifica di permessi, membership o stato tecnico fuori workflow.
- Nessun bypass di RLS/RPC.

# Workflow

1. Conferma hotel e piano attivi.
2. Recupera solo dati pertinenti.
3. Esegue o propone l'azione richiesta.
4. Se emerge un guasto, passa alla segnalazione canonica manutenzione.
5. Registra l'esito.

# Validation

Ogni azione deve mantenere `hotel_id`, piano e identità coerenti fino al completamento.
