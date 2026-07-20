# Editor and CRDT PRD

## Goal

Build a Notion-like WYSIWYG RFD editor backed by Yjs and one Durable Object per RFD, with checkpoints into that RFD's Artifacts repository.

## Dependencies

- `01-foundation`: identity, authorization, schemas, infrastructure package.
- `02-rfd-artifact`: committed read, head SHA, checkpoint.

## Deliverables

### Markdown compatibility spike

Before collaborative persistence:

- Evaluate Tiptap Markdown parse/serialize for the supported subset.
- Define the ProseMirror schema for RFD bodies.
- Golden fixtures: headings, paragraphs, emphasis, links, lists, blockquotes, inline code, fenced code, horizontal rules.
- Tables only if round trips preserve meaning.
- Frontmatter stays outside the editor document.
- Reject unsupported syntax visibly.

### Single-user editor

- Tiptap with block menu, slash commands, toolbar, shortcuts, code blocks, links, outline.
- Metadata controls for title, status, authors, relationships.
- Show clean, dirty, saving, saved, disconnected, conflicted states.
- Mobile-usable critical controls.

### Yjs document

- Bind Tiptap to Yjs.
- Yjs is the active draft authority.
- Awareness for names, colors, cursors, selections (not persisted as content).
- Comments are workstream 04.

### Durable Object

One object per RFD:

```text
rfdId
```

Owns WebSocket sessions, Yjs updates/snapshots, base commit SHA, room status.

Bootstrap:

1. Resolve Artifact head via repository service.
2. Load Yjs snapshot if base SHA matches head.
3. Otherwise load committed Markdown and initialize Yjs server-side.
4. Persist snapshot before accepting collaborative edits.

### Checkpoint integration

- Explicit save (and optional idle later).
- Serialize → validate → `RfdRepository.checkpoint`.
- On success: clear dirty, update base SHA.
- On failure: keep draft; surface tagged error.

### Connection recovery

- Reconnect after DO eviction and Worker deploy.
- Do not drop unacked updates without recovery path.

## Suggested file ownership

```text
apps/web/src/components/editor/
apps/web/src/server/rooms/
packages/infra/  (DO class binding)
```

## Tests

- Markdown golden fixtures.
- Single-client edit + checkpoint.
- Two-client convergence.
- Bootstrap from empty and from existing commit.
- Checkpoint failure leaves draft intact.

## Acceptance criteria

- Two users edit the same RFD and converge.
- Checkpoint commits current CRDT state to that RFD's Artifact.
- Room recovers after disconnect.
- Unsupported Markdown is not silently dropped.

## Out of scope

- Comment threads (04)
- Memory indexing (05)
- Agents (06)
