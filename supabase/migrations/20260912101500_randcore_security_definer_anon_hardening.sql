-- Resolve the live RandCore finding without weakening the health gate.
-- EyeCentral RPCs keep their authenticated entry point and in-function PIN checks;
-- the internal RandGuide trigger helper is not an API and remains owner/trigger-only.

revoke execute on function public.eye_central_invoice_page(text, text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.eye_central_invoice_page(text, text, integer, integer, timestamptz)
  to authenticated;

revoke execute on function public.eye_central_review_page(text, text, integer, integer)
  from public, anon;
grant execute on function public.eye_central_review_page(text, text, integer, integer)
  to authenticated;

revoke execute on function public.eye_central_review_page(text, text, integer, integer, timestamptz)
  from public, anon;
grant execute on function public.eye_central_review_page(text, text, integer, integer, timestamptz)
  to authenticated;

revoke execute on function public.eye_central_review_upsert(text, text, jsonb)
  from public, anon;
grant execute on function public.eye_central_review_upsert(text, text, jsonb)
  to authenticated;

revoke execute on function public.randguide_snapshot_procedure_internal()
  from public, anon, authenticated;
