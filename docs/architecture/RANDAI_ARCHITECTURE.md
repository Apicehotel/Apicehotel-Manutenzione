# RandAI architecture

RandAI is an operational maintenance assistant embedded in RandApp. It is not a generic chatbot and must never bypass RandApp authorization.

## Product contract

RandAI helps a maintainer understand what to do next using this source order:

1. approved internal hotel procedure;
2. approved manufacturer/manual documentation;
3. relevant maintenance history visible to the current user;
4. AI synthesis, clearly labelled as AI guidance.

If no approved source exists, RandAI says so and gathers diagnostic facts instead of inventing a procedure.

## Current foundation

The first runtime slice is local and deterministic:

- authenticated RandApp session decides the active hotel;
- internal procedures are hotel-scoped;
- the assistant opens as an in-app floating panel;
- Hotel Giò includes the first approved procedure for Jazz air conditioning not cooling;
- the same procedure is intentionally unavailable to Chocohotel and Brigantino;
- no external AI service is required for this deterministic first slice.

## First approved procedure

Hotel Giò / Jazz / climatizzazione / non raffredda:

1. verify the measured temperature in the affected Jazz area;
2. if abnormal, establish whether more Jazz floors are affected;
3. inspect the outdoor motor located at 1st Jazz;
4. remember that this motor serves air conditioning for all four Jazz floors;
5. record temperature, affected floors and motor state before moving to later checks.

Safety-critical electrical, pressurised, gas, fire, lift and similar work remains subject to qualified-person procedures.

## Target architecture

Maintainer -> RandAI UI -> authenticated RandApp backend -> hotel and permission checks -> retrieval -> approved evidence -> model -> proposed answer/action -> user confirmation -> RandApp write path.

The model never receives unrestricted database access and never owns application permissions.

## Knowledge layers

### Internal procedures
Structured operational knowledge written and approved by the hotel maintenance team. Every record is hotel-scoped and versioned.

Suggested fields: id, hotel_id, title, category, area, symptom, approved_steps, caution, owner, version, status, approved_at, updated_at.

### Manuals and documents
Manufacturer manuals, internal PDFs, plant maps, technical sheets and photos. Documents must retain hotel/equipment metadata and access policy.

### Equipment registry
A future registry connects hotel -> zone -> system -> equipment -> location -> served areas. Example: the outdoor Jazz motor at 1st Jazz serves the four Jazz floors.

### Maintenance history
RandAI may retrieve only intervention history already allowed by the current user/hotel permissions.

## AI layer

The model is deliberately provider-agnostic. A backend adapter may later use Vercel AI SDK or another approved model gateway. Model credentials remain server-side.

The model receives retrieved evidence, not an unrestricted database dump. Responses must expose their evidence type: Procedura interna, Manuale tecnico, Storico RandApp, or Suggerimento IA.

## Action policy

Read/search actions may run automatically within the user permissions. Writes such as creating, completing, deleting or changing operational records are proposals until the user confirms them.

## Hotel isolation

Every knowledge lookup starts with hotel_id. Cross-hotel retrieval is forbidden unless an explicitly authorized administrative workflow is designed for it. Knowledge from Hotel Giò must not answer a Chocohotel or Brigantino maintenance query.

## Next implementation slices

1. move internal procedures from source code to Supabase tables with RLS and approval/version workflow;
2. add equipment/location relationships;
3. add document ingestion and search for internal manuals;
4. connect maintenance/intervention context to RandAI;
5. add server-side model adapter and evidence-grounded generation;
6. add draft intervention/tool calls with explicit human confirmation;
7. add image and voice input after the text/evidence path is stable.
