# Agents PRD (MCP, Code Mode, Dynamic Workers)

## Goal

Expose RFD capabilities to agents through a first-party remote MCP server, and run in-app agent composition via Cloudflare Code Mode on Dynamic Workers. Both paths call the same authorized Effect services.

## Dependencies

- `01-foundation` through `05-memory-chat`: catalog, repository, comments, memory, chat, auth.

## Concepts (doc-accurate)

| Piece | Role |
| --- | --- |
| Remote MCP | Streamable HTTP MCP server; OAuth as the user |
| Code Mode (`@cloudflare/codemode`) | Model writes one JS plan; progressive tool discovery |
| Dynamic Workers (`env.LOADER`) | Isolated executor (`DynamicWorkerExecutor`) |
| Connectors | Host-side tools; secrets never enter the sandbox |

Code Mode is experimental; isolate behind a package boundary.

## Deliverables

### Infrastructure

- Worker Loader binding `LOADER`.
- Export `CodemodeRuntime` from the Worker entry (Vite plugin or manual export).
- Durable agent/chat surface as needed (Agents SDK `AIChatAgent` or equivalent integration with existing stack).

### Remote MCP server

- Deploy MCP endpoint on the app Worker (or dedicated route).
- OAuth so tools run as the signed-in user (align with Better Auth / MCP OAuth patterns).
- Goal-oriented tools (not a full REST mirror):

```text
list_rfds
get_rfd
search_memory
create_rfd
fork_rfd
comment
checkpoint   # authz-gated
```

- Tool handlers call Effect services; enforce the same permissions as the web app.
- Prefer `createMcpHandler` or `McpAgent` per CF guidance; choose based on session needs.

### Code Mode runtime (in-app)

```ts
createCodemodeRuntime({
  ctx,
  executor: new DynamicWorkerExecutor({
    loader: env.LOADER,
    // default globalOutbound: null
  }),
  connectors: [new RfdConnector(...), new MemoryConnector(...)],
})
```

- Model receives the single `codemode` tool.
- Connectors wrap list/get/fork/comment/checkpoint/search_memory.
- Mark mutating tools with `requiresApproval: true` where human confirmation is required.
- Implement approve / reject / pending UI hooks.
- Optional `revert` for compensating actions when practical.

### Code Mode as MCP (optional but recommended)

- `codeMcpServer()` wraps the RFD MCP tool set so external clients get a single `code` tool that composes upstream tools in a sandbox.
- Keeps large tool schemas out of every turn when using progressive patterns.

### Security requirements

- Sandbox: no Artifacts binding, no user API keys, no open internet by default.
- Connectors perform authz on the host.
- Do not return secrets in tool results.
- Audit Code Mode executions (status, connector methods) without logging full document bodies.

## Suggested file ownership

```text
packages/agents/
apps/web/src/server/mcp/
apps/web/src/server/codemode/
packages/infra/  (LOADER binding)
```

## Tests

- MCP tool list and authz denial cases.
- OAuth session maps to application user.
- Code Mode completed execution with read-only connectors.
- Approval pause/resume for a mutation.
- Negative: sandbox env does not contain provider secrets.
- Memory search via MCP uses the OAuth user's container only.

## Acceptance criteria

- External MCP client can list/get RFDs as an authorized user.
- In-app agent can run a Code Mode plan that composes RFD tools on Dynamic Workers.
- Mutations respect authz and approval policy.
- No secret leakage to browser or sandbox.
- Core app works if agent features are disabled.

## Out of scope

- Deployer-funded Workers AI as the only model path
- Unrestricted user-uploaded Workers with full account bindings
- Release engineering workstream
