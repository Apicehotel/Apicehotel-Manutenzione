# RandAI Agent Supply-Chain Security

## Decision

RandAI keeps **RandCore/RLS/RPC and RandTool Gateway as the canonical authorization boundary**. Agent-component scanning is an admission and CI security layer; it does not grant permissions, route tools, or become a second runtime.

The original RandRadar candidate `invariantlabs-ai/mcp-scan` evolved into **Snyk Agent Scan**. The integration therefore targets the maintained successor rather than pinning RandAI to an obsolete package name.

## Threats covered

The gate focuses on agent-specific supply-chain risks that are not fully covered by dependency audit or Promptfoo authorization tests:

- prompt-injection/override instructions embedded in skills;
- hard-coded credentials in skills or MCP manifests;
- destructive/remote shell payloads embedded in agent component text;
- MCP servers launched through unrestricted shell wrappers;
- unpinned `npx`/`uvx` execution in MCP configuration;
- inline MCP secrets;
- malformed or non-inspectable MCP registries.

## Two-layer design

### 1. Mandatory deterministic Rand gate

`scripts/scan-agent-supply-chain.mjs` scans the repository without network calls and without executing MCP servers. High and critical findings fail CI.

Commands:

```bash
npm run test:agent-supply-chain
npm run scan:agent-supply-chain
```

This layer is always available, including pull requests without external credentials.

### 2. Optional Snyk Agent Scan enrichment

The Group 1 workflow can run Snyk Agent Scan **v0.6.2**, with the Linux binary checksum pinned and verified before execution. The external scan is enabled only when `SNYK_TOKEN` is configured.

Automatic CI scans `rand-skills` only. It deliberately does **not** start MCP servers from pull-request configuration: Agent Scan must launch stdio servers to inspect their dynamic tool descriptions, and executing unreviewed MCP commands in CI would invert the trust boundary.

Dynamic MCP scanning may only be introduced later in a reviewed disposable/sandbox environment with explicit trusted-server admission. It must never bypass the deterministic manifest gate or RandTool Gateway.

## Data boundary

When Snyk Agent Scan is enabled, component information needed for analysis can be sent to Snyk's Agent Scan API. Secrets are expected to be redacted by the scanner, but operational secrets and hotel data must not be placed in skill files or MCP descriptions in the first place.

The deterministic Rand gate is local and sends nothing externally.

## Relationship to existing Group 1 controls

- **RandTool Gateway:** runtime authorization and hotel/scope enforcement; remains canonical.
- **Promptfoo:** behavioral/evaluation regression gate; remains canonical.
- **OpenTelemetry/Phoenix:** observability; unchanged.
- **ToolHive:** optional MCP adapter/runtime behind RandTool Gateway; unchanged.
- **Agent supply-chain gate:** admission/scanning before an agent component is trusted.

These layers solve different problems and do not duplicate ownership.

## Promotion policy

A new skill or MCP component is not trusted because a scanner passes it. Promotion still requires RandSkills/RandRadar governance, license/maintenance review where applicable, permission bounding, tests, human review, and the normal branch + pull-request process.

Unknown, malformed, unpinned, or suspicious agent components fail closed.

## Zombie policy

The old `mcp-scan` name is retained only as historical provenance in documentation. No obsolete runtime dependency is added. If Snyk Agent Scan later becomes unmaintained or weaker than another option, RandRadar can classify a replacement, but only one external enrichment scanner should be active at a time.
