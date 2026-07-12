# Infrastructure

## Project layout

Infrastructure lives in `packages/infra` and is composed with Alchemy v2. The workspace root exposes convenience scripts that invoke the package without moving deployment dependencies into the web application.

```text
apps/
  web/
packages/
  domain/
  infra/
  repository/
  memory/
  proposals/
```

The exact package split can remain smaller until code requires independent ownership. `alchemy.run.ts` is the composition root.

## Initial Alchemy deployment

The first infrastructure change follows Alchemy's onboarding sequence exactly:

1. Create the isolated `packages/infra` package.
2. Install Alchemy v2, Effect, and platform dependencies.
3. Declare one Cloudflare R2 bucket and no Worker.
4. Ask for confirmation.
5. Run `bun alchemy deploy` and complete the Cloudflare profile login.
6. Confirm the bucket is live.
7. Stop before adding further resources.

The bucket validates Alchemy setup. It is not the Git repository backend. Cloudflare Artifacts remains the only durable store for committed RFD files.

## Application stack

After the initial deployment, the stack adds:

- Cloudflare Website Vite resource for TanStack Start
- D1 database and migrations
- RFD branch Durable Object class
- Cloudflare Artifacts namespace binding
- Workers AI binding when deployer-funded AI is enabled
- Queues or event consumers for indexing and Artifacts push events
- Worker secrets or Secrets Store bindings
- Stage-specific configuration

## TanStack Start deployment

The Website resource builds `apps/web` and binds infrastructure into the server Worker. It uses `nodejs_compat` and routes server requests before static assets.

Server modules access bindings through a deferred environment proxy so TanStack Start development does not read `cloudflare:workers` bindings outside a request context.

## Artifacts integration

The stack declares the Artifacts namespace binding. The repository is created or recovered by an authenticated bootstrap operation, then recorded as workspace configuration.

`env.ARTIFACTS` handles repository lookup and short-lived token creation. Transient `isomorphic-git` operations create and push commits to the Artifacts remote. The transient filesystem is discarded after each operation and is not a storage layer.

Repository operations should minimize Worker memory:

- Fetch the required branch only.
- Use shallow history when the operation permits it.
- Materialize only relevant files.
- Push against an expected parent.
- Enforce document and diff size limits.

## Durable Objects

One namespace hosts RFD branch objects. Object names derive from a canonical encoded tuple of workspace, RFD, and branch.

SQLite-backed storage contains:

- Yjs snapshots
- Incremental Yjs updates awaiting compaction
- Base commit SHA
- Room status
- Schema version

Snapshots must be chunked before they approach the per-row BLOB limit. Alarms can trigger idle checkpoints and compaction.

## D1

D1 migrations cover:

- `users`
- `sessions`
- `oauth_accounts`
- `rfd_memberships`
- `comment_threads`
- `comment_replies`
- `proposals`
- `artifact_events`
- `usage_quotas`
- `user_provider_credentials`

Migrations are versioned and applied by the infrastructure stack. Database rows reference Git SHAs and RFD IDs rather than duplicating committed Markdown.

## Memory configuration

```ts
type MemoryConfig =
  | { _tag: "Disabled" }
  | { _tag: "SupermemoryHosted"; apiKey: SecretRef }
  | { _tag: "SupermemorySelfHosted"; baseUrl: URL; apiKey: SecretRef }
```

The selected configuration builds one `Memory` Effect layer. Hosted mode uses the fixed Supermemory API origin. Self-hosted production mode requires a deployer-configured endpoint reachable by the Worker. Local development permits a loopback endpoint.

## AI configuration

```ts
type AiFundingPolicy =
  | { _tag: "DeployerOnly" }
  | { _tag: "UserOnly" }
  | { _tag: "DeployerOrUser"; default: "deployer" | "user" }
```

Deployer-funded generation uses `env.AI`. User-funded generation calls the Cloudflare Workers AI REST endpoint with a user account ID and scoped token. Model names come from a deployment allowlist.

## Stages

- Local development uses `alchemy dev`, remote Artifacts when required, local D1/DO behavior where supported, and optional local Supermemory.
- Preview stages use isolated D1 and Durable Object resources and must not index production memories.
- Production uses stable resource names and explicit deployment approval.

No deployment runs without confirmation. Alchemy profiles manage Cloudflare credentials; the project does not require users to export account ID or API token environment variables for Alchemy.

## Observability

Record structured events for:

- WebSocket connections and recovery
- Checkpoint duration and result
- Artifacts pushes and conflicts
- Supermemory indexing latency and failures
- Proposal generation provider, model, duration, and token usage
- Quota denials

Logs contain operation IDs, workspace IDs, RFD IDs, branches, and commit SHAs. They never contain document bodies, OAuth tokens, repository tokens, Supermemory keys, or user AI tokens.
