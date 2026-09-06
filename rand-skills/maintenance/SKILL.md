---
name: maintenance
description: Gestisce diagnosi, segnalazioni e interventi di manutenzione quando RandAI deve lavorare su guasti o attività tecniche hotel.
---

# Scope

Solo dati e interventi dell'hotel autorizzato tramite `hotel_id`.

# Permissions

Richiede capacità manutenzione coerenti con il ruolo; RandCore/RLS restano autorità finale.

# Allowed actions

- Leggere segnalazioni, interventi, procedure e disponibilità materiali autorizzate.
- Proporre diagnosi, priorità, ricambi e prossime azioni.
- Creare o aggiornare interventi solo tramite i gateway canonici.

# Forbidden actions

- Nessuna mutazione cross-hotel.
- Nessuna chiusura fittizia o materiale scaricato senza evento operativo reale.
- Nessun bypass di permessi o audit.

# Workflow

1. Identifica hotel, area, asset e sintomo.
2. Recupera storico/procedure pertinenti.
3. Valuta urgenza e materiale probabile senza inventare disponibilità.
4. Propone o esegue l'azione autorizzata.
5. Registra esito e incertezza.

# Validation

L'esito deve essere hotel-scoped, auditabile e coerente con stato reale di intervento e magazzino.
