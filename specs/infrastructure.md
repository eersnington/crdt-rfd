# Infrastructure

## Project layout

Infrastructure lives in `packages/infra` and is composed with Alchemy v2.

```text
apps/
  web/
packages/
  domain/
  infra/
  repository/   # Artifacts + git operations (when split)
  memory/       # user Supermemory adapter (when split)
  agents/       # MCP + Code Mode (when split)
```

The exact package split can stay smaller until code requires independent ownership. `alchemy.run.ts` is the composition root.

## Current foundation (done)

Already deployed and wired:

- D1 database + foundation migrations (Better Auth, memberships, workspace_settings historical)
- Website (TanStack Start) with env bindings for auth
- R2 bucket as Alchemy onboarding probe (not product storage for RFD bodies)

## Application stack (target)

Add as workstreams require:

- Cloudflare Artifacts namespace binding (`ARTIFACTS`)
- RFD document-room Durable Object class
- Worker Loader binding (`LOADER`) for Dynamic Workers / Code Mode
- Optional Queues + Artifacts event subscriptions for `pushed` / `forked` automation
- Worker secrets or Secrets Store for encryption keys (user credential encryption)

## Artifacts integration

```text
[[artifacts]]
binding = "ARTIFACTS"
namespace = "<stage>"   # e.g. default | dev | prod
```

- Namespace is deployment-scoped (environment or single default).
- Repositories are created per RFD: `rfd-{rfdId}`.
- Use binding for create/get/fork/tokens/log.
- Use isomorphic-git for file content commit/push.
- Local dev may need remote Artifacts (`remote = true` where supported) after Wrangler auth.
- Artifacts is closed beta; access must be obtained for live integration.

Operational limits to design around:

- 10 GB maximum storage per repository
- 2,000 control-plane requests / 10s per namespace
- 2,000 Git requests / 10s per artifact

## Durable Objects

One namespace hosts RFD document rooms. Object name derives from `rfdId`.

SQLite-backed storage contains:

- Yjs snapshots (chunked before row BLOB limits)
- Incremental Yjs updates awaiting compaction
- Base commit SHA
- Room status
- Schema version

Alarms can trigger idle checkpoints and compaction later.

Code Mode durable runtime uses a CodemodeRuntime facet (via `@cloudflare/codemode` + Vite plugin export). Keep agent runtime storage separate from the document room when both exist.

## Worker Loader

```text
[[worker_loaders]]
binding = "LOADER"
```

Required for `DynamicWorkerExecutor`. Sandbox policy:

- Default `globalOutbound: null` (no open internet)
- Inject only capability stubs (connector RPC), never raw secrets
- Timeouts and custom limits as needed

## D1

Extend migrations beyond foundation for:

```text
rfd_catalog              # public list + artifact name + head + fork lineage
rfd_memberships          # owner | editor | commenter (migrate from older roles)
comment_threads
comment_replies
user_memory_config
user_ai_credentials      # encrypted
user_rfd_interactions
artifact_events          # idempotency if using push events
```

Rows reference artifact names and SHAs; they do not replace Git history.

## Memory configuration (user)

No deploy-time single Supermemory key for all users as the product default. Each user stores:

- Off | Hosted API key | Self-hosted base URL + API key

Hosted default origin: Supermemory cloud API. Self-hosted uses the same SDK with `baseURL`.

## AI configuration (user)

Users supply credentials for an allowlisted provider. Encrypt at rest. Decrypt only for outbound model calls on the host Worker.

## Stages

- Local: `alchemy dev`, local D1/DO where supported, remote Artifacts when required, optional local Supermemory (`baseURL` loopback).
- Production: stable resource names; Artifacts namespace separate from dev if needed for rate isolation.

## Observability

Record structured events for:

- WebSocket connections and recovery
- Checkpoint duration and result
- Artifacts create/fork/push failures
- Supermemory index and search latency
- Chat provider errors (no bodies/secrets)
- Code Mode execution status (completed / paused / error)
- MCP auth failures

Logs may include operation IDs, user IDs, RFD IDs, artifact names, and commit SHAs. Never log document bodies, OAuth tokens, Artifacts tokens, Supermemory keys, or user AI tokens.
