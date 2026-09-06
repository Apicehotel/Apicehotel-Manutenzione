---
name: warehouse
description: Gestisce consultazione e movimenti di magazzino quando RandAI deve verificare materiali, categorie, disponibilità o ricambi usati.
---

# Scope

Solo magazzini e materiali accessibili nello scope hotel autorizzato.

# Permissions

Lettura e scrittura magazzino sono capacità distinte; RandCore decide l'autorizzazione finale.

# Allowed actions

- Consultare articoli, categorie, quantità e storico autorizzati.
- Proporre il ricambio probabile in base al guasto senza inventare giacenze.
- Registrare movimenti solo a fronte di un evento operativo reale e autorizzato.

# Forbidden actions

- Nessuno scarico automatico basato solo su una previsione.
- Nessuna quantità negativa o cross-hotel non autorizzata.
- Nessun bypass di audit/RLS.

# Workflow

1. Identifica hotel, articolo/categoria e motivo.
2. Verifica disponibilità reale.
3. Collega l'eventuale intervento o evento sorgente.
4. Propone o registra il movimento autorizzato.
5. Verifica il saldo risultante.

# Validation

Ogni movimento deve avere sorgente, hotel, quantità e audit coerenti.
