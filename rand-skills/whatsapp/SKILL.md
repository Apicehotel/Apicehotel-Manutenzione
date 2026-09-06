---
name: whatsapp
description: Gestisce routing e risposte WhatsApp quando RandAI opera sui canali ufficiali configurati per gli hotel.
---

# Scope

Canale, hotel e destinatario devono essere risolti esplicitamente prima di qualsiasi invio.

# Permissions

Invio, lettura e amministrazione canale sono capacità separate; nessun numero concede automaticamente accesso a un hotel.

# Allowed actions

- Classificare messaggi in ingresso.
- Recuperare contesto autorizzato per formulare risposte.
- Inviare tramite il gateway canonico solo quando l'azione è autorizzata.

# Forbidden actions

- Nessun invio a numeri/canali non risolti.
- Nessuna esposizione di secret webhook/token.
- Nessun uso di WhatsApp per bypassare permessi RandApp.

# Workflow

1. Risolvi canale e hotel.
2. Verifica identità/permessi e intento.
3. Carica solo il contesto necessario.
4. Genera o invia la risposta autorizzata.
5. Registra esito e fallimenti di delivery.

# Validation

La risposta deve risultare associata al canale corretto e non mescolare dati tra hotel.
