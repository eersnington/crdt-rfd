# Architecture

## Runtime components

### TanStack Start application

The application runs as a Cloudflare Worker deployed through Alchemy. Public pages render RFD indexes and committed documents. Authenticated routes host editing, review, ownership, and provider settings.

Server endpoints use Effect HTTP with schema-validated request and response boundaries. Browser code does not access Artifacts, Supermemory, or AI credentials directly.

### RFD branch Durable Object

A Durable Object instance is addressed by:

```text
workspaceId:rfdId:branch
```

Using the branch in the identity isolates proposal editing from main. Each instance owns:

- One active Yjs document
- WebSocket sessions
- Awareness and cursor broadcasts
- Persisted Yjs updates and compacted snapshots
- The Git base commit SHA
- Clean, dirty, checkpointing, or conflicted state

The object does not own committed history. It can reconstruct its base from the corresponding Artifacts branch.

### Cloudflare Artifacts

One Artifacts repository is the canonical store for committed content. The Worker uses `env.ARTIFACTS` to access the repository and mint short-lived tokens. Git operations run transiently in the Worker and push to the Artifacts remote. No second repository store is introduced.

### D1

D1 stores operational state that does not belong in RFD Markdown:

- Users, sessions, and GitHub identities
- RFD ownership and role assignments
- Comment threads and replies
- Proposal workflow status
- Push-event idempotency
- Usage quotas and provider preferences
- Encrypted user AI credentials when enabled

### Supermemory

Supermemory is a derived index. It can be disabled, hosted, or self-hosted. Artifacts remains canonical, so the index can be rebuilt from committed main-branch documents.

### Proposal model

The proposal model is selected through an Effect layer. Deployer-funded mode uses the Workers AI binding. User-funded mode calls Workers AI's REST API with the signed-in user's account ID and API token.

## Service boundaries

Application code depends on Effect services rather than Cloudflare bindings directly.

```ts
RfdRepository
  read
  history
  checkpoint
  createProposalBranch
  compare
  merge

DocumentRooms
  connect
  snapshot
  notifyExternalCommit

RfdCatalog
  list
  getMetadata
  create
  assignRole

Comments
  createThread
  reply
  resolve
  listForDocument

Memory
  indexCommit
  search
  removeCommit

ProposalModel
  generateRevision
```

Each implementation maps provider failures into tagged domain errors with enough context to retry or recover.

## Realtime editing flow

```text
Browser edit
  -> Tiptap transaction
  -> Yjs update
  -> Durable Object WebSocket
  -> persist update
  -> broadcast to peers
```

Awareness data is ephemeral and is not part of the persisted RFD. Document updates are persisted before acknowledgement when needed for recovery. Periodic compaction replaces long update histories with a full Yjs snapshot.

## Document bootstrap

1. Resolve the branch head in Artifacts.
2. Load the existing Yjs snapshot when its base SHA matches the branch head.
3. Otherwise read the committed Markdown and build a new Yjs document server-side.
4. Persist the snapshot and base SHA before accepting collaborative edits.
5. Connect the browser after initialization completes.

Server-side bootstrap prevents two first clients from initializing different documents.

## Checkpoint flow

```text
Durable Object snapshot
  -> Tiptap/ProseMirror Markdown serialization
  -> frontmatter and Markdown validation
  -> expected-head comparison
  -> transient Git commit
  -> push to Cloudflare Artifacts
  -> update room base SHA and clean state
  -> enqueue Supermemory indexing for main
```

The push must be conditional on the expected parent. A changed remote head produces `BranchAdvanced`, leaving the Yjs draft intact.

## Proposal flow

1. Checkpoint the source branch.
2. Create a proposal branch from the resulting commit.
3. Search Supermemory for relevant decisions and constraints.
4. Build a bounded prompt with the current RFD, memory citations, instruction, and allowed path.
5. Generate a candidate Markdown body through `ProposalModel`.
6. Validate metadata, path restrictions, Markdown, and output size.
7. Commit and push to the proposal branch.
8. Store proposal status and summary in D1.
9. Render a source-to-proposal diff for review.

The model cannot push directly and never receives a repository token.

## Comment model

Live comments use encoded Yjs relative positions so their ranges move with concurrent edits. Diff comments use immutable comparison coordinates:

```ts
type CommentAnchor =
  | { _tag: "DocumentRange"; branch: string; start: Uint8Array; end: Uint8Array }
  | { _tag: "DiffLine"; baseSha: string; headSha: string; side: "base" | "head"; line: number }
```

Thread data lives in D1. The Durable Object distributes changes to connected clients.

## External push flow

```text
Artifacts pushed event
  -> validate and deduplicate
  -> resolve changed refs and RFD paths
  -> notify affected Durable Objects
  -> reload clean rooms or mark dirty rooms conflicted
  -> index committed main changes
```

Conflict resolution operates on a preserved local Yjs snapshot and the new remote Markdown. Neither side is silently discarded.

## Consistency rules

- Artifacts is authoritative for committed content.
- The Durable Object may contain newer uncommitted content.
- Every branch operation begins with a checkpoint or explicit clean-state verification.
- Every room records the commit from which its Yjs document was initialized.
- Supermemory only indexes commits that are reachable from main.
- D1 references Git commits but does not duplicate committed document bodies.
