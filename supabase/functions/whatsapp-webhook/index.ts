// Endpoint legacy ritirato dal Punto 7.
//
// Conserviamo la funzione con una risposta esplicita affinche un eventuale
// deploy completo neutralizzi anche una vecchia funzione remota. Il solo
// ingresso Twilio supportato e `randai-whatsapp-inbound`, dietro il proxy
// `/api/whatsapp/incoming`, e passa sempre da RandGateway.

const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

Deno.serve(() => new Response(JSON.stringify({
  ok: false,
  error: "legacy_whatsapp_webhook_retired",
  replacement: "randai-whatsapp-inbound",
}), { status: 410, headers }));
