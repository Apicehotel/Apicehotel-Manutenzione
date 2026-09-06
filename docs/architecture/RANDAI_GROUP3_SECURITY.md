# Group 3 security boundary

Durable state is not authorization state. Stored actor/hotel identifiers are references used for revalidation, never reusable permission grants. Resume must fail closed when identity or scopes are no longer valid. Cross-hotel resume is forbidden. Fresh knowledge is resolved before workflow execution and projection data remains non-authoritative. Mutating tools remain subject to RandTool Gateway and Safe Write/RLS even when invoked from a resumed workflow.
