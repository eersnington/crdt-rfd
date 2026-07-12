# CRDT RFD platform

## Summary

This project is a public Request for Discussion platform for writing, reviewing, and preserving technical proposals. Authors edit RFDs together in a Notion-like editor. Yjs provides the CRDT, and a Cloudflare Durable Object coordinates each active RFD branch over WebSockets.

Committed RFDs are Markdown files in one Cloudflare Artifacts repository owned by the deployment. Git history records checkpoints, proposals, reviews, and merges. Authors own individual RFDs through application permissions; they do not need to create GitHub repositories or manage Cloudflare infrastructure.

Supermemory indexes decisions and constraints from committed RFDs. An author can ask an AI model to create an alternative proposal. The system checkpoints the live document, creates a Git branch, retrieves relevant memories, commits the generated revision to that branch, and presents a reviewable diff.

## Product principles

- Humans collaborate through CRDT documents.
- Agents edit isolated Git branches.
- Cloudflare Artifacts preserves committed history.
- Supermemory preserves derived organizational context.
- Public reading requires no account.
- Creating, editing, reviewing, and merging RFDs follow explicit ownership rules.
- Deployers choose who pays for AI and which Supermemory endpoint is used.

## System outline

```text
Browser
  Tiptap editor + Yjs
  Reader, presence, comments, history, and proposal diff
                |
TanStack Start Cloudflare Worker
  Effect HTTP API, GitHub auth, authorization, orchestration
                |
  +-------------+-------------+----------------+----------------+
  |             |             |                |                |
Durable       D1       Cloudflare         Supermemory       Workers AI
Objects                 Artifacts
```

## Source-of-truth boundaries

| State | Authority |
| --- | --- |
| Active collaborative draft | Yjs state in the RFD branch Durable Object |
| Committed RFD content and history | Cloudflare Artifacts Git repository |
| Users, ownership, comments, and workflow metadata | D1 |
| Derived decisions and semantic context | Supermemory |

## Repository layout

One deployment owns one Artifacts repository:

```text
/rfds/
  0001-request-for-discussion.md
  0002-storage-architecture.md

/assets/
/workspace.json
```

## Documents

- [Product requirements](./product-requirements.md)
- [Architecture](./architecture.md)
- [Domain model](./domain-model.md)
- [Infrastructure](./infrastructure.md)
- [Security](./security.md)
- [Testing](./testing.md)
- [Progress](./progress.md)

## Implementation workstreams

Each workstream has an agent-ready PRD and its own progress tracker.

| Workstream | Scope | Depends on |
| --- | --- | --- |
| [01 Foundation](./01-foundation/prd.md) | Alchemy, Effect contracts, D1, GitHub OAuth, authorization | None |
| [02 Artifacts](./02-artifacts/prd.md) | Repository bootstrap, reads, commits, branches, diffs, merges, clone tokens | 01 |
| [03 Editor and CRDT](./03-editor-crdt/prd.md) | Tiptap, Markdown boundary, Yjs, Durable Objects, checkpoints | 01, 02 |
| [04 Comments and review](./04-comments-review/prd.md) | Yjs-relative comments, D1 threads, diff review | 01, 03; diff integration uses 06 |
| [05 Supermemory](./05-supermemory/prd.md) | Hosted/self-hosted layers, indexing, semantic search | 01, 02, 03 |
| [06 Agent proposals](./06-agent-proposals/prd.md) | Workers AI funding modes, proposal branches, revisions, merge | 01, 02, 03, 05 |
| [07 Git conflicts](./07-git-conflicts/prd.md) | Artifacts events, room reconciliation, conflict resolution | 02, 03, 05, 06 |
| [08 Release](./08-release/prd.md) | Stages, CI/CD, observability, docs, release gates | 01-07 |

Progress: [01](./01-foundation/progress.md), [02](./02-artifacts/progress.md), [03](./03-editor-crdt/progress.md), [04](./04-comments-review/progress.md), [05](./05-supermemory/progress.md), [06](./06-agent-proposals/progress.md), [07](./07-git-conflicts/progress.md), [08](./08-release/progress.md).

## MVP completion

The MVP is complete when two users can edit the same RFD, checkpoint it into Artifacts, create an AI-authored proposal branch using Supermemory context, review its diff, and merge it without losing concurrent or externally pushed changes.
