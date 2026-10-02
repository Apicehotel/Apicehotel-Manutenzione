# Supabase space separation

## Goal

Use one temporary Supabase project without mixing application ownership.

Current boundaries:

- **HotelGio**: separate legacy repository/project. It is not modified by this repository.
- **MultiHotel / RandApp**: owns the current `public` operational schema while the migration is in progress.
- **Eye Supremo**: owns the dedicated `eye_supremo` schema facade plus its private Storage bucket `eye-invoices`.

This is intentionally a **transitional architecture**. Supabase is not treated as the permanent runtime: the final target is a PC/local backend.

## Why a facade first

Existing Eye data already lives in `public.eye_central_*`. Moving those production tables in one step would risk RPC, RLS, jobs and older Eye builds.

Migration `20261002060000_eye_supremo_space_facade.sql` therefore creates:

- schema `eye_supremo`;
- security-invoker views over existing `public.eye_*` objects;
- a small `eye_supremo.space_manifest`;
- service-role-only access to the new schema.

No production table is renamed, moved or deleted.

## Rules

1. HotelGio is out of scope and must not be changed.
2. New Eye-specific DB objects belong in `eye_supremo`, not generic `public`.
3. Existing Eye RPCs remain in `public` until the Eye client/gateway has been migrated.
4. MultiHotel domain data stays under the existing MultiHotel ownership during this transition.
5. No new Supabase project is required.
6. Future PC migration should preserve the domain boundary: MultiHotel and Eye Supremo get separate database namespaces/data directories even when hosted on the same machine.

## Later cutover

After Eye clients use the schema facade/gateway consistently:

1. move physical Eye tables into `eye_supremo`;
2. add compatibility wrappers only where older releases still need them;
3. remove public Eye aliases after the supported upgrade window;
4. migrate Eye Supremo to its local PC database/backend;
5. remove the temporary Supabase facade.

The migration must be performed with backup and explicit human review.
