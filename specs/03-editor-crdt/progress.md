# Editor and CRDT progress

## Status

`implemented-awaiting-live-verification`

## Checklist

- [x] Markdown subset spike and golden fixtures.
- [x] Single-user Tiptap editor + metadata controls.
- [x] Yjs binding and awareness.
- [x] Durable Object room per `rfdId`.
- [x] Server-side bootstrap from Artifact head.
- [x] Checkpoint from room to `RfdRepository`.
- [x] Connection recovery tests.
- [x] Multi-client convergence tests.

## Blockers

- Live Cloudflare verification still needs two browser sessions, Durable Object eviction, and an
  actual Artifact checkpoint.

## Implementation notes

- The Yjs document uses `content` for the Tiptap `Y.XmlFragment` and `metadata` for validated
  frontmatter fields.
- Durable Object storage keeps a merged Yjs snapshot with a 5 MB limit. Individual updates are
  limited to 1 MB and are persisted before broadcast.
- Artifacts remains committed authority; room checkpoints compare the room base SHA against the
  remote Git head and never force-push.
