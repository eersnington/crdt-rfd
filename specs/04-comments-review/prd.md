# Comments and review PRD

## Goal

Add durable threaded comments to live CRDT documents and immutable proposal diffs without putting comment data inside committed RFD Markdown.

## Dependencies

- `01-foundation`: users, sessions, permissions, and D1.
- `03-editor-crdt`: Yjs documents, relative positions, and document-room broadcasts.
- Proposal diff integration can be completed after `06-agent-proposals` exposes comparison views.

## Deliverables

### D1 schema

Add migrations for:

```text
comment_threads
comment_replies
```

Thread fields include:

- Thread ID, RFD ID, and branch
- Anchor kind and encoded anchor payload
- Creator and creation timestamp
- Open, resolved, or outdated status
- Resolver and resolution timestamp
- Base/head commit SHAs for diff comments

Replies include author, body, creation time, and optional edit metadata.

### Anchor types

Live document comments use Yjs relative positions:

```ts
{ _tag: "DocumentRange"; branch; start; end }
```

Proposal diff comments use immutable comparison coordinates:

```ts
{ _tag: "DiffLine"; baseSha; headSha; side; line }
```

- Encode and decode Yjs anchors through a shared schema.
- Resolve anchors against the current Yjs document.
- Mark a thread outdated when the anchor cannot resolve safely.
- Never silently attach a comment to a different range.

### Effect service

Implement `Comments` with operations for listing, creating, replying, resolving, reopening, and marking threads outdated. Authorization is checked inside the service boundary, not only in UI routes.

### Realtime updates

- Broadcast thread creation, replies, resolution, and anchor changes through the relevant document room.
- Do not merge comments into the primary Yjs document.
- Reconnect clients fetch a D1 snapshot and then receive realtime changes.

### Editor UI

- Create a thread from the current text selection.
- Display anchored markers and a review sidebar.
- Navigate between open threads.
- Show author, time, replies, and resolution state.
- Indicate outdated anchors clearly.
- Keep keyboard navigation and screen-reader labels usable.

### Diff UI

- Display inline and side-by-side RFD diffs.
- Allow comments on changed lines on either side.
- Keep comments attached to the exact base/head comparison.
- When a proposal advances, retain previous comments and mark those not applicable to the new comparison as outdated.

## API surface

```text
GET  /api/rfds/:id/comments?branch=...
POST /api/rfds/:id/comments
POST /api/comments/:threadId/replies
POST /api/comments/:threadId/resolve
POST /api/comments/:threadId/reopen
```

## Suggested file ownership

```text
packages/comments/
apps/web/src/components/comments/
apps/web/src/components/diff/
apps/web/src/routes/api.comments.*
```

## Tests

- Anchor schema and authorization tests.
- Concurrent edit tests showing Yjs-relative anchors move with content.
- Deleted-range test resulting in an outdated thread.
- D1 thread, reply, resolve, and reopen tests.
- Reconnect test loading the same thread state.
- Diff comment tests across proposal revisions.
- XSS and unsafe-link rendering tests.
- Keyboard and screen-reader browser tests.

## Acceptance criteria

- An authorized reviewer can comment on a live text range.
- The anchor follows concurrent edits where Yjs can resolve it.
- An unresolvable anchor becomes outdated rather than moving incorrectly.
- Reviewers can discuss and resolve threads.
- Proposal diff comments remain tied to immutable comparison SHAs.
- Comment changes appear to connected collaborators without changing RFD Markdown.
- `vp check`, `vp test`, affected builds, and comment browser tests pass.

## Out of scope

- Anonymous comments unless workspace policy adds them later
- Email notifications
- Comment export into Git commits
- General-purpose annotations outside RFD documents
