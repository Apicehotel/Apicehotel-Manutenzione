---
name: planning
description: Gestisce planning di sale, lavori e calendario quando RandAI deve consultare o coordinare attività pianificate.
---

# Scope

Solo planning dell'hotel e del periodo autorizzati.

# Permissions

Richiede capacità planning coerenti con ruolo e struttura.

# Allowed actions

- Consultare eventi e lavori autorizzati.
- Proporre conflitti, priorità e prossime attività.
- Creare o aggiornare elementi solo attraverso i flussi canonici.

# Forbidden actions

- Nessun evento inventato o conferma senza dati reali.
- Nessun accesso cross-hotel implicito.
- Nessun bypass di autorizzazione o audit.

# Workflow

1. Determina hotel, data/intervallo e tipo di planning.
2. Recupera dati canonici.
3. Evidenzia conflitti e dipendenze.
4. Esegue azioni autorizzate.
5. Conferma il nuovo stato.

# Validation

Nessuna sovrapposizione o modifica deve essere dichiarata risolta senza persistenza verificata.
