# RandGateway — Punto 7

## Esito

RandGateway è l'ingresso canonico dei canali Rand. RandChat, MCP, Twilio/WhatsApp, email e adapter futuri traducono il proprio formato in un envelope comune, ma non possono concedere identità, permessi, rischio o autorizzazione.

Flusso obbligatorio per un comando:

`Adapter → RandGateway → Identità/Hotel/Ruolo → Tool Gateway → RandSecure/HITL → Action Gateway → RandAudit`

Un adapter che chiama direttamente Action Gateway o scrive una tabella operativa viola il contratto. I normali messaggi di chat possono usare il proprio data plane persistente; quando chiedono a RandAI o propongono un'azione entrano in RandGateway.

## Componenti

- `supabase/functions/_shared/rand-gateway/envelope.js`: envelope v1, normalizzazione e idempotenza.
- `supabase/functions/_shared/rand-gateway/adapters.js`: adapter puri RandChat, MCP e Twilio.
- `supabase/functions/_shared/rand-gateway/gateway.js`: sequenza fail-closed identità → policy → HITL → azione → audit.
- `supabase/functions/_shared/rand-gateway/supabase-store.js`: persistenza server-only.
- `supabase/functions/rand-gateway/index.ts`: ingresso autenticato per RandChat e MCP.
- `api/mcp.js`: MCP Streamable HTTP stateless con SDK ufficiale stabile `1.30.0`.
- `supabase/functions/randai-whatsapp-inbound/index.ts`: verifica firma Twilio, conservazione inbox/media e consegna al gateway; nessuna scrittura diretta in `segnalazioni`.
- `supabase/functions/whatsapp-webhook/index.ts`: endpoint legacy ritirato con risposta `410`; non conserva più un secondo percorso operativo.

## Envelope v1

L'envelope contiene `id`, `traceId`, timestamp, canale, direzione, actor dichiarato, conversazione, payload e origine. Il blocco `security` viene sempre ricostruito in stato non attendibile:

```json
{
  "authenticated": false,
  "identityConfidence": "none",
  "riskLevel": "UNKNOWN",
  "hitlRequired": true
}
```

Solo Identity/Tool/HITL Gateway possono cambiarne l'esito. Le annotazioni MCP rimangono in `externalAnnotations` e non modificano la policy Rand.

## Persistenza e sicurezza

- `rand_gateway_envelopes`: ingressi idempotenti e risultato finale.
- `rand_gateway_audit`: log append-only delle decisioni.
- `rand_gateway_external_identities`: associazioni esterne tramite hash HMAC, mai autorizzazione basata sul solo numero.
- `rand_gateway_tool_policies`: allowlist canonica per canale/server/tool.
- `rand_mcp_servers`: server esterni disabilitati per default e limitati per hotel.
- `rand_gateway_queue`: contratto RandQueue durevole e indipendente dal provider.

Tutte le tabelle sono RLS-enabled e server-only. Il `service_role` non entra mai nel browser o nell'endpoint MCP.

## RandChat Realtime

Postgres resta la fonte di verità. I messaggi vengono consegnati live tramite Broadcast privato sui topic:

- `randchat:group:<uuid>:messages`
- `randchat:dm:<uuid>:messages`

Le policy su `realtime.messages` verificano membership del gruppo/thread. Il client non riceve permesso di pubblicare Broadcast: gli eventi nascono da trigger DB dopo la scrittura autorizzata. Le membership continuano temporaneamente con Postgres Changes perché hanno frequenza bassa.

## MCP

MCP espone soltanto le azioni già possedute dall'Action Gateway:

- `issue.update_priority`
- `issue.set_waiting_part`
- `issue.mark_done`

Il primo passaggio di una mutazione produce un'approvazione; il secondo deve presentare l'`approvalId`. Il bearer viene validato da Supabase, hotel e ruolo vengono risolti server-side, e l'allowlist Rand prevale sulle annotazioni MCP. `stdio` resta consentito soltanto per processi locali controllati; il remoto usa Streamable HTTP.

## Twilio temporaneo

Twilio è solo transport WhatsApp. La firma `X-Twilio-Signature`, quota, routing numero→hotel, deduplicazione e conservazione media restano attivi. Dopo la validazione, il messaggio entra in RandGateway. Anche con ingestion attiva il webhook non crea più una segnalazione: prepara suggerimenti e lascia la creazione alla revisione protetta già esistente.

Le policy WhatsApp dei tool sono predisposte ma disabilitate. Per abilitarle servono sia un'identità esterna verificata sia il worker di approvazione: nessuna impersonazione service-role dell'utente è ammessa.

## Confini congelati

- RandGateway non ragiona e non sostituisce RandAI.
- RandMCP non orchestra e non autorizza.
- Realtime non è lo storico.
- Un numero WhatsApp non è un'identità sufficiente.
- Un allegato non è un prompt o un comando.
- MCP Registry non è una trust list.
- Nessun adapter può scrivere direttamente in `segnalazioni`.
