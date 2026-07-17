# Architecture

## Runtime components

### TanStack Start application

The application runs as a Cloudflare Worker deployed through Alchemy. Public routes render the RFD list and committed documents. Authenticated routes host editing, membership, settings, chat, and agent session surfaces.

Server endpoints use Effect with schema-validated request and response boundaries. Browser code does not access Artifacts, Supermemory, AI credentials, or Worker Loader directly.

### RFD Durable Object (document room)

A Durable Object instance is addressed by `rfdId` (and branch only if multi-branch editing is introduced later). Each instance owns:

- One active Yjs document
- WebSocket sessions
- Awareness and cursor broadcasts
- Persisted Yjs updates and compacted snapshots
- The Git base commit SHA for the RFD's Artifact
- Clean, dirty, checkpointing, or conflicted state

The object does not own committed history. It reconstructs its base from the RFD's Artifacts repository head when needed.

### Cloudflare Artifacts

One deployment binds one Artifacts **namespace** (`env.ARTIFACTS`). Inside that namespace, **each RFD is one repository**.

Control plane (binding):

- `create`, `get`, `list`, `delete`, `import`
- Repo handle: `createToken`, `listTokens`, `revokeToken`, `fork`, `log`, `readCommit`, `readTree`

Data plane (Git):

- Binding does not read or write file contents.
- Workers use isomorphic-git with a transient in-memory filesystem to commit and push to the repo `remote`.
- Git Basic auth password is the token secret only (`token.split("?expires=")[0]` when expiry metadata is present).

Default repo name: `rfd-{rfdId}`. Default document path: `rfd.md`.

### D1

D1 stores operational state that does not belong in RFD Markdown:

- Users, sessions, and GitHub identities
- RFD catalog (public list metadata, artifact repo name, head SHA, fork lineage)
- RFD memberships and comment policy
- Comment threads and replies
- User Supermemory config and encrypted AI credentials
- Interaction markers used for indexing scope
- Push-event or job idempotency keys when used

### Supermemory

Supermemory is a per-user derived index. Configuration is owned by the user (hosted API key, or self-hosted base URL + key, or off). Artifacts remain canonical for document bodies.

### Agents: MCP, Code Mode, Dynamic Workers

These are layered, not three independent backends.

| Layer | Role |
| --- | --- |
| Remote MCP | Standard tool surface for Cursor, Claude, and other MCP hosts; OAuth as the user |
| Code Mode (`@cloudflare/codemode`) | Model writes one JS plan that composes tools; progressive discovery via `codemode.search` / `describe` |
| Dynamic Workers (`env.LOADER`) | Isolated executor for that plan (`DynamicWorkerExecutor`); default no outbound network |
| Connectors | Host-side tool implementations (Effect services); secrets stay on the host |

Code Mode is experimental. Isolate it behind a clear package boundary.

## Service boundaries

Application code depends on Effect services rather than Cloudflare bindings directly.

```ts
RfdCatalog
  list
  get
  create
  assignRole
  setCommentPolicy

RfdRepository
  read
  history
  checkpoint
  fork
  mintCloneToken

DocumentRooms
  connect
  snapshot
  notifyExternalCommit

Comments
  createThread
  reply
  resolve
  listForDocument

UserMemory
  configure
  indexInteraction
  search
  health

Chat
  complete  // user AI key + memory context

AgentRuntime
  mcp tools
  codemode runtime handle
```

Each implementation maps provider failures into tagged domain errors.

## Create RFD flow

```text
createRfd(user)
  -> allocate RfdId
  -> env.ARTIFACTS.create("rfd-{id}", { setDefaultBranch: "main" })
  -> isomorphic-git: write rfd.md, commit, push remote
  -> D1 catalog row (owner, public, artifactName, headSha)
  -> D1 membership owner
  -> return RfdSummary
```

## Realtime editing flow

```text
Browser edit
  -> Tiptap transaction
  -> Yjs update
  -> Durable Object WebSocket
  -> persist update
  -> broadcast to peers
```

Awareness is ephemeral and is not part of the committed RFD.

## Checkpoint flow

```text
Durable Object snapshot
  -> Markdown serialization
  -> frontmatter and Markdown validation
  -> mint short-lived write token for that repo
  -> isomorphic-git commit + push to Artifacts remote
  -> update room base SHA and clean state
  -> update D1 catalog head / updatedAt
  -> enqueue user memory indexing for interactors
```

## Fork flow

```text
forkRfd(sourceId, user)
  -> load source catalog + artifact name
  -> sourceRepo = ARTIFACTS.get(sourceName)
  -> sourceRepo.fork("rfd-{newId}", { defaultBranchOnly: true })
  -> D1 new RFD owner=user, forkedFrom={ sourceId, commitSha? }
  -> return new RfdSummary
```

## Comment model

Live comments use encoded Yjs relative positions so ranges move with concurrent edits.

```ts
type CommentAnchor =
  | { _tag: "DocumentRange"; start: Uint8Array; end: Uint8Array }
```

Thread data lives in D1. The Durable Object distributes changes to connected clients.

## Memory and chat flow

```text
user configures Supermemory (hosted | self-hosted | off) + AI keys
interact / checkpoint
  -> if memory on: add document with containerTag user_{userId}
     customId rfd:{rfdId}:commit:{sha}
chat
  -> profile/search on containerTag
  -> call user model with bounded citations
```

## Agent flow

```text
External MCP client
  -> OAuth as user
  -> MCP tools call Effect services

In-app agent
  -> createCodemodeRuntime({
       ctx,
       executor: new DynamicWorkerExecutor({ loader: env.LOADER }),
       connectors: [RfdConnector, MemoryConnector],
     })
  -> model calls codemode tool with generated code
  -> sandbox invokes connector methods via RPC
  -> connectors enforce authz and call Effect services
```

Sandbox policy:

- No Artifacts binding, no user API keys, no open `fetch` by default (`globalOutbound: null`).
- Mutations that create side effects may set `requiresApproval: true` and pause for human approve/reject.

## External push flow (slim)

When Artifacts push events are wired:

```text
repo.pushed
  -> resolve RFD by artifact name
  -> notify document room
  -> reload clean rooms or mark dirty rooms conflicted
  -> reindex for users who track that RFD
```

Conflict resolution preserves local Yjs draft and remote Markdown; neither side is silently discarded.

## Consistency rules

- Each RFD's Artifacts repository is authoritative for committed content of that RFD.
- The Durable Object may contain newer uncommitted content.
- Checkpoints target only the selected RFD repository.
- Supermemory never becomes the source of truth for document bodies.
- D1 references artifact names and commit SHAs but does not store full bodies as canonical history.
