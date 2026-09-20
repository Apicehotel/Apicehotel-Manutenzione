# RandApp product truth

## Product

RandApp is a private multi-hotel operations PWA for hotel staff. It coordinates operational work across Hotel Giò, Chocohotel, and Hotel Il Brigantino.

## Audience

Reception, maintenance staff, housekeepers, warehouse users, congress/event staff, managers, and authorized administrators. Users may work quickly from a phone, with gloves, poor lighting, limited attention, and intermittent connectivity.

## Core jobs

- Report and resolve maintenance issues.
- Coordinate planning, rooms, halls, supplies, warehouse, notifications, and operational follow-up.
- Provide hotel-scoped visibility and safe actions.
- Give RandAI context-aware assistance without bypassing authorization.

## Constraints

- Mobile-first: iOS, Android, tablet, and Windows desktop.
- Italian operational language; labels must be concrete and unambiguous.
- Grande mode and accessibility are first-class.
- Offline behavior must be explicit and recoverable.
- Supabase RLS/RPC is the final authorization authority.
- No secret, service-role key, PIN, or private token belongs in frontend code.
- Existing RandUI is canonical; do not introduce a competing design system.

## Success criteria

A surface is successful when a staff member can understand the next action immediately, complete it with minimal taps, see the resulting state, and recover safely from errors or offline sync failures.
