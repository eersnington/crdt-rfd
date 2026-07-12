# Domain model

## Terms

### Workspace

One deployed RFD platform. A workspace owns one Cloudflare Artifacts repository and one configuration policy. The MVP does not host multiple independent workspaces in one deployment.

### RFD

A numbered technical proposal with validated metadata and a Markdown body. An RFD has one or more authors and can have several Git branches.

### Author

A user with primary control over an RFD. Repository ownership remains with the deployment; RFD ownership is an application permission recorded in D1 and durable attribution recorded in frontmatter.

### Coauthor

A user allowed to edit and checkpoint an RFD. A coauthor does not automatically gain permission to merge proposals or change ownership.

### Reviewer

A user allowed to comment and request revisions. Merge permission is separate and can be granted by the author or workspace policy.

### Branch

A Git ref in the Artifacts repository. `main` contains accepted RFD content. Proposal branches contain isolated alternatives or revisions.

### Document room

The active collaborative session for one RFD branch. A room is implemented by one Durable Object and contains the Yjs state derived from a specific base commit.

### Checkpoint

A validated conversion of the active CRDT document into a Git commit. A checkpoint advances a branch from an expected parent SHA.

### Proposal

A branch-based alternative to an RFD. A proposal records its source branch, source commit, target branch, current head, author or agent, summary, and review state.

### Comment thread

A discussion attached to a live document range or an immutable diff location. Threads have replies and can be open, resolved, or outdated.

### Memory

Derived knowledge extracted from a committed RFD, such as a decision, constraint, assumption, rejected alternative, or open question. A memory always cites its source commit and file path.

## Identifiers

Use branded schema types for identifiers rather than interchangeable strings:

- `WorkspaceId`
- `UserId`
- `RfdId`
- `RfdNumber`
- `BranchName`
- `CommitSha`
- `ProposalId`
- `CommentThreadId`
- `MemoryId`

An RFD ID is stable application identity. Its number is presentation and filename metadata.

## RFD metadata

```yaml
---
number: 2
title: Storage Architecture
status: discussion
authors:
  - github:alice
created: 2026-07-12
updated: 2026-07-12
reviewers:
  - github:bob
supersedes: []
related:
  - 0001
---
```

Statuses form a closed set:

```text
draft -> discussion -> accepted
                    -> rejected
accepted -> superseded
```

Transitions are authorized operations. Arbitrary status strings are invalid.

## RFD access roles

```ts
type RfdRole = "author" | "coauthor" | "reviewer"

type RfdPermission =
  | "edit"
  | "checkpoint"
  | "comment"
  | "create-proposal"
  | "merge-proposal"
  | "manage-members"
  | "transfer-ownership"
```

Workspace policy maps roles to permissions. Ownership transfer must leave at least one author.

## Document room state

```ts
type RoomStatus =
  | { _tag: "Clean"; baseSha: CommitSha }
  | { _tag: "Dirty"; baseSha: CommitSha; changedAt: Date }
  | { _tag: "Checkpointing"; baseSha: CommitSha; operationId: string }
  | { _tag: "Conflicted"; baseSha: CommitSha; remoteSha: CommitSha }
```

This union prevents contradictory combinations such as clean and conflicted at the same time.

## Proposal state

```text
generating -> open -> revising -> open
                    -> merged
                    -> abandoned
generating -> failed
```

A failed proposal retains its source commit and diagnostic details. It does not create a success-shaped empty branch.

## Memory provenance

```ts
type MemorySource = {
  workspaceId: WorkspaceId
  rfdId: RfdId
  filePath: string
  branch: "main"
  commitSha: CommitSha
  section?: string
  type:
    | "decision"
    | "assumption"
    | "constraint"
    | "rejected-alternative"
    | "open-question"
    | "relationship"
    | "superseded-decision"
}
```

Memory content without provenance is invalid for proposal generation.

## Main invariants

- Every RFD has at least one author.
- Every active room refers to an existing RFD and branch.
- A clean room's base SHA equals the corresponding branch head.
- A checkpoint never changes a branch when its expected parent no longer matches.
- A proposal target branch differs from its source branch.
- Only validated Markdown is committed by the application.
- Only main-branch commits are indexed as organizational memory.
- Every generated proposal changes only its allowed RFD path.
- Every merge is initiated by an authorized human.
