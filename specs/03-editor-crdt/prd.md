# Editor and CRDT PRD

## Goal

Build a Notion-like WYSIWYG RFD editor backed by a proper Yjs CRDT and one Durable Object per RFD branch.

## Dependencies

- `01-foundation`: identity, authorization, schemas, and infrastructure package.
- `02-artifacts`: committed RFD reads and branch heads.

## Deliverables

### Markdown compatibility spike

Before implementing realtime collaboration:

- Install and evaluate Tiptap's supported Markdown parser and serializer.
- Define the exact ProseMirror schema used by RFD documents.
- Build golden fixtures for headings, paragraphs, emphasis, links, lists, blockquotes, inline code, fenced code, and horizontal rules.
- Evaluate tables separately and enable them only when round trips preserve meaning.
- Keep frontmatter outside the editor document.
- Compare normalized Markdown syntax trees rather than formatting bytes.
- Reject unsupported syntax visibly instead of dropping it.

The spike is a release gate. Do not proceed with collaborative persistence until the supported subset is documented and tested.

### Single-user editor

- Build a Tiptap editor with a block menu, slash commands, formatting toolbar, keyboard shortcuts, code blocks, links, and document outline.
- Provide dedicated metadata controls for title, status, authors, reviewers, and relationships.
- Show clean, dirty, saving, saved, disconnected, and conflicted states.
- Preserve a readable public preview.
- Support mobile editing without hiding critical save or connection state.

### Yjs document

- Bind Tiptap's ProseMirror document to Yjs.
- Treat the Yjs document as the active draft authority.
- Use Yjs awareness for names, colors, cursors, and selections.
- Do not persist awareness data as document content.
- Encode comments separately; comments are implemented by workstream 04.

### Durable Object

Implement one object per canonical tuple:

```text
workspaceId:rfdId:branch
```

Responsibilities:

- Authenticate and authorize WebSocket upgrades through the application Worker.
- Load an existing Yjs snapshot or bootstrap from committed Markdown server-side.
- Accept and broadcast Yjs protocol messages.
- Persist incremental updates.
- Compact updates into snapshots using alarms or thresholds.
- Record base commit SHA and room state.
- Recover after eviction, hibernation, or Worker deployment.
- Expose an internal snapshot operation for checkpointing.

Use a hibernation-compatible WebSocket design. Presence timers must not prevent hibernation.

### Room state

Implement the union defined in the domain model:

```text
Clean
Dirty
Checkpointing
Conflicted
```

Local edits move clean to dirty. Successful checkpoints update the base SHA and return to clean. External branch changes are handled by workstream 07.

### Checkpoint integration

- Add explicit save and configurable idle checkpoint triggers.
- Obtain a consistent Yjs snapshot from the room.
- Serialize the ProseMirror document to supported Markdown.
- Combine it with validated frontmatter.
- Call `RfdRepository.checkpoint` with the room's base SHA.
- Keep the draft dirty when serialization, validation, or Git push fails.
- On success, store the returned commit SHA as the new base.

## API and WebSocket surface

```text
GET  /api/rfds/:id/editor?branch=...
POST /api/rfds/:id/checkpoint
GET  /api/rfds/:id/connect?branch=...   Upgrade: websocket
```

Internal Durable Object RPC:

```text
snapshot
checkpointStarted
checkpointSucceeded
checkpointFailed
notifyExternalCommit
```

## Suggested file ownership

```text
apps/web/src/components/editor/
apps/web/src/routes/rfds.$id.edit.*
packages/collaboration/
packages/infra/src/document-room.ts
```

## Tests

- Golden Markdown round-trip suite.
- Property tests for supported Markdown transformations.
- Tiptap command, paste, metadata, and accessibility tests.
- Two-client convergence with concurrent insert, delete, and formatting operations.
- Duplicate and reordered Yjs update tests.
- Server-side bootstrap race test.
- Durable Object eviction and reconnect tests.
- Snapshot compaction equivalence test.
- Worker deployment disconnect and recovery test.
- Checkpoint success, validation failure, provider failure, and stale-parent tests.
- Browser tests on desktop and mobile viewports.

## Acceptance criteria

- Two authenticated authors can edit one RFD branch and converge.
- Presence and cursors work without entering persisted document content.
- A room recovers after eviction without losing acknowledged edits.
- Supported Markdown survives import, collaboration, and export.
- An explicit checkpoint commits the current CRDT state to Artifacts.
- A failed checkpoint preserves the active draft and displays a recoverable error.
- `vp check`, `vp test`, affected builds, and collaboration browser tests pass.

## Out of scope

- Comments and review threads
- AI-generated proposals
- Automatic merge conflict resolution
- Offline-first editing
