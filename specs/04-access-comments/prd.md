# Access and comments PRD

## Goal

Ship ownership/invite UX and durable threaded comments on live CRDT documents, with public-by-default read and configurable who may comment.

## Dependencies

- `01-foundation`: users, sessions, D1, authz primitives.
- `03-editor-crdt`: Yjs documents, relative positions, room broadcasts.

## Deliverables

### Roles and policies

- Roles: `owner`, `editor`, `commenter` (migrate domain from author/coauthor/reviewer).
- Comment policy: `anyone` | `members-only`.
- Owner can invite, change roles, remove members, transfer ownership (last owner invariant).
- Public can read committed RFDs without membership.

### D1 schema

```text
rfd_memberships   # updated role set
comment_threads
comment_replies
```

Thread fields: thread id, rfd id, anchor payload, creator, timestamps, open/resolved/outdated, resolver.

### Anchors

```ts
{ _tag: "DocumentRange"; start: Uint8Array; end: Uint8Array }
```

- Encode/decode Yjs relative positions through shared schema.
- Resolve against current Yjs doc; mark outdated when unsafe.

### UX

- Notion-like comment sidebar / inline affordances.
- Reply threads, resolve, reopen if needed.
- Show outdated state clearly.
- Membership panel for owners.

### Realtime

- DO broadcasts comment events to connected clients.
- Persistence in D1 is source of truth for thread bodies.

## API surface

```text
GET/POST membership routes for an RFD
PATCH comment policy
POST thread / reply / resolve
GET threads for document
```

## Suggested file ownership

```text
apps/web/src/server/comments/
apps/web/src/server/authorization/
apps/web/src/components/comments/
packages/domain/  (roles, anchors)
```

## Tests

- Permission matrix for edit/comment/manage.
- Anyone vs members-only comment policy.
- Concurrent edit keeps anchors when possible.
- Unauthorized comment rejected.
- Resolve and outdated transitions.

## Acceptance criteria

- Owner invites editor and commenter successfully.
- Anyone can comment when policy allows; otherwise only members with comment permission.
- Threads survive concurrent edits reasonably; outdated anchors are marked.
- Comment bodies are not stored in committed Markdown.

## Out of scope

- Diff-line review comments for proposal branches (not MVP centerpiece)
- Agents
