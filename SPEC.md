# RFC: Branchable Realtime RFD Platform

## Status

Draft

## Summary

Build a focused RFD platform with:

- Durable Objects and CRDTs for realtime collaborative editing
- ArtifactFS as the canonical Git-backed document store
- Supermemory for semantic recall across decisions and prior RFDs
- Agent-created alternative proposals on Git branches

The product should feel as polished and readable as Oxide’s RFD site, while adding realtime editing, Git-native branching, and memory-aware agents.

## Product Goal

Let teams write, discuss, and review technical proposals in realtime.

At any point, a user can ask an agent to create an alternative version of the current RFD. The agent snapshots the live document, creates a Git branch in ArtifactFS, edits the proposal using relevant context from Supermemory, and presents a reviewable diff.

## Core User Story

A team is editing an RFD together.

A user asks:

> Create an alternative version that uses Durable Objects instead of Postgres.

The system:

1. Reads the latest CRDT state.
2. Saves a snapshot to ArtifactFS.
3. Creates a new Git branch.
4. Retrieves related decisions and constraints from Supermemory.
5. Edits the RFD on that branch.
6. Shows a side-by-side diff.
7. Allows comments, revisions, and merge.

## Scope

### Included

- RFD index and reader
- Markdown-based RFD documents
- Realtime multi-user editing
- Presence and cursors
- Inline comments
- Git-backed document history
- Branch creation
- Agent-created alternative proposals
- Side-by-side branch diff
- Merge into the main branch
- Semantic search across committed RFDs
- Retrieval of prior decisions during agent tasks

### Excluded

- MDX
- React Server Components
- Dynamic Workers
- User-defined executable components
- General-purpose wiki databases
- Complex workflow automation
- External integrations
- Full GitHub pull request compatibility
- Fine-grained enterprise permissions

## System Architecture

```text
Browser
  ├─ RFD reader
  ├─ Markdown editor
  ├─ CRDT client
  ├─ Presence
  ├─ Comments
  └─ Branch diff UI
          │
          ▼
Cloudflare Worker
  ├─ Authentication
  ├─ RFD API
  ├─ Branch operations
  ├─ Agent orchestration
  └─ Supermemory queries
          │
   ┌──────┼───────────────┐
   ▼      ▼               ▼
Durable   ArtifactFS      Supermemory
Objects
```

## Component Responsibilities

### Durable Objects

Use one Durable Object per active RFD.

Responsibilities:

- Hold the CRDT document state
- Manage WebSocket sessions
- Broadcast realtime updates
- Track presence and cursors
- Store draft comments
- Produce deterministic Markdown snapshots

Durable Objects own active collaborative state, not permanent document history.

### ArtifactFS

Use one ArtifactFS repository per workspace.

Suggested layout:

```text
/rfds/
  0001-request-for-discussion.md
  0002-storage-architecture.md

/assets/
/workspace.json
```

Responsibilities:

- Canonical Markdown files
- Git branches
- Commits
- Diffs
- Merge history
- Local clone, pull, and push support
- Agent task branches

ArtifactFS is the source of truth.

### Supermemory

Store derived knowledge from committed RFDs.

Memory types:

- decisions
- assumptions
- rejected alternatives
- constraints
- open questions
- relationships between RFDs
- superseded decisions

Each memory should reference:

```json
{
  "workspaceId": "workspace_123",
  "rfdId": "0002",
  "filePath": "rfds/0002-storage-architecture.md",
  "commitSha": "abc123",
  "branch": "main"
}
```

Supermemory should not replace ArtifactFS or duplicate full repository state.

## Document Lifecycle

### Realtime Editing

```text
User edit
→ CRDT update
→ Durable Object
→ WebSocket broadcast
```

### Checkpointing

Create a Git commit when:

- the user explicitly saves
- a configurable idle period passes
- an agent task starts
- a review is requested
- a branch is merged

Do not commit every CRDT update.

```text
CRDT state
→ serialize Markdown
→ validate
→ write to ArtifactFS
→ commit
→ index in Supermemory
```

## Agent Proposal Flow

### Input

The user selects an RFD and asks for an alternative.

Example:

> Rewrite this proposal around Durable Objects while preserving the existing latency and migration constraints.

### Execution

1. Flush the current CRDT state.
2. Commit a checkpoint to the current branch.
3. Create a new branch:

```text
proposal/0002-durable-objects
```

4. Search Supermemory for:

- related RFDs
- previous architectural decisions
- known constraints
- rejected alternatives

5. Give the agent:

- current RFD Markdown
- retrieved context
- branch name
- allowed repository paths
- requested change

6. Agent edits only the branch.
7. Validate the Markdown.
8. Commit the result.
9. Generate a diff against the source branch.
10. Show the result in the browser.

### Review

Users can:

- comment on changed sections
- ask the agent for revisions
- update the branch manually
- merge the proposal
- abandon the branch

## Data Consistency Rules

### Source of Truth

ArtifactFS is authoritative for committed content.

The Durable Object may contain newer uncommitted state.

### Snapshot Rule

Any branch or agent operation must begin by snapshotting the current CRDT state.

### External Git Changes

When a user pushes through Git:

1. Detect the new commit.
2. Update the stored file version.
3. Notify the relevant Durable Object.
4. If no uncommitted CRDT changes exist, reload the document.
5. If local edits exist, create a conflict state instead of overwriting them.

### Memory Indexing

Only index committed content.

On a new main-branch commit:

1. Extract decisions and assumptions.
2. Write memories with commit references.
3. Mark superseded memories when supported by the new document.
4. Keep prior memories for history.

## Required UI

### RFD Index

- RFD number
- title
- status
- author
- updated date

### RFD Reader

- polished typography
- document outline
- metadata
- related RFDs
- branch indicator
- commit history

### Editor

- Markdown editing
- live preview
- collaborators
- comments
- save state

### Proposal View

- source branch
- proposal branch
- side-by-side or inline diff
- agent summary
- comments
- merge and abandon actions

## Suggested RFD Frontmatter

```yaml
---
number: 2
title: Storage Architecture
status: discussion
authors:
  - alice
created: 2026-07-12
updated: 2026-07-12
reviewers:
  - bob
supersedes: []
related:
  - 0001
---
```

## Minimal API Surface

```text
GET    /api/rfds
GET    /api/rfds/:id
POST   /api/rfds/:id/checkpoint
POST   /api/rfds/:id/comments
POST   /api/rfds/:id/proposals
GET    /api/rfds/:id/proposals/:branch
POST   /api/rfds/:id/proposals/:branch/revise
POST   /api/rfds/:id/proposals/:branch/merge
DELETE /api/rfds/:id/proposals/:branch
GET    /api/search
```

Realtime editing should use WebSockets connected to the document Durable Object.

## Agent Contract

The agent receives:

```json
{
  "workspaceId": "workspace_123",
  "rfdId": "0002",
  "sourceBranch": "main",
  "targetBranch": "proposal/0002-durable-objects",
  "instruction": "Rewrite the proposal around Durable Objects.",
  "allowedPaths": ["rfds/0002-storage-architecture.md"],
  "memoryContext": [],
  "currentDocument": ""
}
```

The agent must:

- edit only allowed paths
- preserve frontmatter
- cite related RFDs when making organizational claims
- avoid changing the source branch
- return a short summary of its changes
- commit all changes to the target branch

## MVP Acceptance Criteria

The MVP is complete when:

1. Two users can edit the same RFD in realtime.
2. The RFD can be cloned and edited through Git.
3. Realtime state can be checkpointed into ArtifactFS.
4. A user can request an alternative proposal.
5. The agent creates and edits a separate branch.
6. The UI shows a readable diff.
7. The proposal can be merged.
8. Supermemory returns relevant prior decisions during proposal generation.
9. Every memory can be traced back to a file path and commit SHA.

## Main Risks

### CRDT and Git divergence

Mitigation:

- snapshot before Git operations
- track the base commit in the Durable Object
- block silent overwrites
- expose conflict resolution in the UI

### Poor memory quality

Mitigation:

- index only committed content
- attach commit references
- keep extracted memory types narrow
- require citations in agent output

### Noisy Git history

Mitigation:

- checkpoint on meaningful events
- avoid per-keystroke commits
- squash agent revision commits before merge when needed

### Agent edits too much

Mitigation:

- restrict allowed paths
- isolate work on branches
- require human merge
- validate frontmatter and Markdown

## Recommended Build Order

1. ArtifactFS-backed RFD reader
2. Markdown editor
3. Durable Object and CRDT sync
4. Checkpoint commits
5. Git branch and diff support
6. Supermemory indexing
7. Agent-created proposals
8. Merge workflow
9. Conflict handling for external Git pushes

## Product Principle

Humans collaborate in realtime.

Agents work through branches.

ArtifactFS preserves history.

Supermemory preserves reasoning.
