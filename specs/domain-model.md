# Domain model

## Terms

### Platform deployment

One deployed instance of the product. Owns Cloudflare resources (Worker, D1, Durable Objects, Artifacts namespace, Worker Loader). Does not own individual RFDs as a product concept.

### RFD

A numbered technical proposal with validated metadata and a Markdown body. Each RFD has exactly one Artifacts repository and one or more members.

### Artifact repository

A Cloudflare Artifacts Git repository for one RFD. Identified by namespace (deployment config) + repo name (typically `rfd-{rfdId}`). Holds committed history for that RFD only.

### Owner

User with primary control of an RFD: membership, comment policy, transfer, and all editor permissions.

### Editor

User allowed to edit and checkpoint an RFD. Does not automatically manage membership or transfer ownership.

### Commenter

User allowed to comment when not covered by public comment policy. Cannot edit or checkpoint.

### Document room

Active collaborative session for one RFD. Implemented by one Durable Object with Yjs state derived from a base commit on that RFD's Artifact.

### Checkpoint

Validated conversion of the active CRDT document into a Git commit on the RFD's Artifact.

### Fork

Product action that creates a new Artifacts repository from a source RFD (binding `fork`) and a new catalog RFD owned by the forker.

### Comment thread

Discussion attached to a live document range. Threads have replies and can be open, resolved, or outdated.

### User memory

Supermemory container for one user (`containerTag` such as `user_{userId}`). Holds derived knowledge from RFDs that user interacted with.

### Interaction

Record that a user opened, edited, commented on, forked, or owns an RFD. Drives indexing eligibility.

## Identifiers

Use branded schema types:

- `UserId`
- `RfdId`
- `RfdNumber`
- `ArtifactRepoName`
- `CommitSha`
- `CommentThreadId`
- `ContainerTag`

An RFD ID is stable application identity. Its number is presentation metadata. Artifact repo name is the Git address within the deployment namespace.

## RFD metadata (frontmatter)

```yaml
---
number: 2
title: Storage Architecture
status: discussion
authors:
  - github:alice
created: 2026-07-12
updated: 2026-07-12
related: []
forkedFrom: null
---
```

Statuses form a closed set:

```text
draft -> discussion -> accepted
                    -> rejected
accepted -> superseded
```

Transitions are authorized operations.

## RFD access

```ts
type RfdRole = "owner" | "editor" | "commenter"

type CommentPolicy = "anyone" | "members-only"

type RfdPermission =
  | "edit"
  | "checkpoint"
  | "comment"
  | "manage-members"
  | "transfer-ownership"
  | "fork" // typically any signed-in user on a public RFD
```

Default permission map:

- `owner`: all permissions including manage-members and transfer-ownership
- `editor`: edit, checkpoint, comment
- `commenter`: comment

Public readers can always read committed content. Comment without membership only when `commentPolicy === "anyone"`.

Ownership transfer must leave at least one owner.

## Catalog record (D1)

```ts
type RfdCatalogEntry = {
  rfdId: RfdId
  number: RfdNumber
  title: string
  status: RfdStatus
  artifactRepoName: ArtifactRepoName
  headSha?: CommitSha
  commentPolicy: CommentPolicy
  forkedFrom?: { rfdId: RfdId; commitSha?: CommitSha }
  createdAt: Date
  updatedAt: Date
}
```

The public list is a query over catalog entries, not a scan of a monorepo.

## Document room state

```ts
type RoomStatus =
  | { _tag: "Clean"; baseSha: CommitSha }
  | { _tag: "Dirty"; baseSha: CommitSha; changedAt: Date }
  | { _tag: "Checkpointing"; baseSha: CommitSha; operationId: string }
  | { _tag: "Conflicted"; baseSha: CommitSha; remoteSha: CommitSha }
```

## User provider config

```ts
type UserMemoryConfig =
  | { _tag: "Off" }
  | { _tag: "Hosted"; apiKeyRef: SecretRef }
  | { _tag: "SelfHosted"; baseUrl: URL; apiKeyRef: SecretRef }

type UserAiConfig = {
  // provider allowlist enforced by app
  provider: "openai-compatible" | "anthropic" | "workers-ai-user"
  // encrypted at rest; never returned to browser after write
  credentialRef: SecretRef
  model: string
}
```

## Memory provenance

Every indexed document should carry metadata sufficient to cite:

- RFD id and number
- Artifact repo name
- Commit SHA
- Optional section heading
- Interaction reason

Prefer Supermemory `customId` such as `rfd:{rfdId}:commit:{sha}` for idempotent re-ingest.

## Main invariants

- Every RFD has at least one owner.
- Every RFD has exactly one Artifacts repository name in its catalog row.
- A clean room's base SHA equals the corresponding Artifact head when last reconciled.
- A checkpoint writes only to that RFD's repository.
- Fork always allocates a new RFD id and new artifact name.
- Only validated Markdown is committed by the application.
- User memory is scoped by that user's container tag; never cross-user by default.
- Agent sandboxes never receive raw provider secrets or Artifacts write tokens.
- Every merge of agent-side effects that mutate state is either authorized as the user or paused for approval.
