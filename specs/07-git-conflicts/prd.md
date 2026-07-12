# Git conflicts PRD

## Goal

Handle external Artifacts pushes and concurrent branch advances without silently overwriting collaborative drafts or reviewed proposals.

## Dependencies

- `02-artifacts`: repository reads, commit history, and expected-parent writes.
- `03-editor-crdt`: room state, snapshots, and external-commit notification.
- `05-supermemory`: main-commit indexing trigger.
- `06-agent-proposals`: reviewed source and proposal heads.

## Deliverables

### Artifacts event subscription

- Provision the Artifacts push event subscription and consumer through Alchemy where supported.
- Validate event type, namespace, repository, ref, before SHA, after SHA, and commit payload.
- Store an idempotency key in D1 before applying side effects.
- Safely retry partial processing.
- Ignore events from other namespaces or repositories.

### Changed RFD detection

- Compare before and after trees to identify changed RFD paths.
- Validate every changed RFD before notifying application state.
- Treat deletion, rename, and invalid committed content as distinct event outcomes.
- Keep event diagnostics actionable without leaking tokens or full document bodies.

### Room reconciliation

For each affected branch room:

- If no room exists, no realtime action is required.
- If the room is clean and its base SHA equals the event's `before`, reload from `after` and broadcast the new base.
- If the room is dirty, enter `Conflicted` with both base and remote SHAs and preserve the Yjs snapshot.
- If the room already observed `after`, treat the event as idempotent.
- If history is unexpected, mark conflict and require inspection.

### Conflict UI

- Show the local collaborative draft, its base commit, and the new remote document.
- Allow an authorized author to choose remote, preserve local as a new proposal, or manually reconcile.
- Never provide a one-click action that silently discards dirty state.
- Record the resolution as a normal Git commit or branch.

### Proposal head protection

- Before merge, verify source and proposal heads match the reviewed diff.
- If either moved, require a refreshed diff and review.
- Return typed `SourceAdvanced` or `ProposalAdvanced` errors.

### Memory integration

- Trigger Supermemory indexing only after validated main-branch push events.
- Deduplicate indexing by commit SHA.
- Do not index conflict snapshots or unmerged branches.

## API surface

```text
GET  /api/rfds/:id/conflict?branch=...
POST /api/rfds/:id/conflict/use-remote
POST /api/rfds/:id/conflict/preserve-local-proposal
POST /api/rfds/:id/conflict/resolve
```

The event consumer is not a public endpoint unless required by Cloudflare event delivery. Any HTTP event boundary must verify Cloudflare-provided authenticity controls.

## Suggested file ownership

```text
packages/repository/src/events/
packages/collaboration/src/conflicts/
apps/web/src/components/conflicts/
packages/infra/src/artifact-events.ts
```

## Tests

- Event schema, repository filtering, and idempotency tests.
- Clean room external update and broadcast test.
- Dirty room conflict preservation test.
- Duplicate and out-of-order event tests.
- Delete, rename, and invalid document tests.
- Preserve-local-as-proposal test.
- Manual reconciliation checkpoint test.
- Reviewed-head mismatch tests for proposal merge.
- Main-only indexing trigger test.
- Live isolated-stage push event test after confirmation.

## Acceptance criteria

- A standard Git push updates a clean active RFD room.
- A push against a dirty room preserves local edits and enters conflict state.
- Authors can inspect and resolve both versions without hidden data loss.
- Duplicate events do not duplicate state transitions or indexing.
- A proposal cannot merge against heads different from those reviewed.
- New validated main commits trigger Supermemory indexing exactly once logically.
- `vp check`, `vp test`, affected builds, and confirmed event integration tests pass.

## Out of scope

- Automatic semantic merge of conflicting rich-text documents
- Force-pushing over external changes
- GitHub webhook integration
- Full Git hosting administration
