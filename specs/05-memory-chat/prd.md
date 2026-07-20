# Memory and chat PRD

## Goal

Let each user bring Supermemory (hosted or self-hosted) and AI keys, automatically index RFDs they interact with, and chat with cited context. Wire the same memory search into MCP later (06).

## Dependencies

- `01-foundation`: secrets storage patterns, D1, auth.
- `02-rfd-artifact`: committed Markdown reads.
- `03-editor-crdt` / `04-access-comments`: interaction signals (open, edit, comment).

## Provider modes

```ts
type UserMemoryConfig =
  | { _tag: "Off" }
  | { _tag: "Hosted"; apiKey: Secret }
  | { _tag: "SelfHosted"; baseUrl: URL; apiKey: Secret }
```

- Hosted: Supermemory cloud API + user API key.
- Self-hosted: same SDK with `baseURL` (local binary or user server).
- Off: core product works; chat/index disabled.

## Deliverables

### Effect services

```ts
interface UserMemory {
  saveConfig(userId, config): Effect<void, MemoryError>
  indexRfd(input: IndexRfdInput): Effect<void, MemoryError>
  search(input: MemoryQuery): Effect<ReadonlyArray<MemoryHit>, MemoryError>
  health(userId): Effect<MemoryHealth, MemoryError>
}

interface Chat {
  complete(input: ChatInput): Effect<ChatResult, ChatError>
}
```

### Container and provenance

- `containerTag`: `user_{userId}` (alphanumeric / `_` / `-` / `:` only; max 100).
- `customId`: `rfd:{rfdId}:commit:{sha}` for idempotent document upserts.
- Metadata: rfd id, number, title, artifact name, commit SHA, interaction kind.

### Indexing pipeline

Trigger when a user interacts (open, edit, comment, fork, own) and when a relevant checkpoint lands:

```text
event
  -> ensure interaction row
  -> if memory Off: stop
  -> read validated Markdown from Artifact
  -> supermemory add/update document with containerTag + customId
```

Do not index other users' private credentials or comments as canonical RFD memory unless product explicitly includes comment text later (MVP: committed RFD body).

### Chat

- Load user AI credentials (decrypted on host only).
- `profile` / search memories for the user container with the question.
- Bound context size; return answer + citations (rfd id, commit, excerpt).
- Allowlisted models/providers only.

### Settings UI

- Connect hosted key or self-hosted URL + key.
- Connect AI provider credentials.
- Disconnect / rotate.
- Health indicator.

## Security

- Encrypt keys at rest.
- Validate self-hosted URLs; HTTPS outside localhost allowlist.
- Never send keys to browser after save or into Dynamic Workers.
- Strict per-user container isolation.

## Suggested file ownership

```text
packages/memory/
apps/web/src/server/memory/
apps/web/src/server/chat/
apps/web/src/routes/settings.*
```

## Tests

- Off / hosted-fake / self-hosted-fake layers.
- Container isolation (user A cannot search user B).
- customId idempotency.
- Interaction gating.
- Chat citation shape.
- Secret redaction.

## Acceptance criteria

- User configures Supermemory and AI keys.
- Interacted RFD commits appear searchable in that user's memory.
- Chat answers with citations when memory is configured.
- App works with memory off.
- No cross-user memory leakage.

## Out of scope

- Deployer-global Supermemory for all users as the only mode
- Indexing dirty uncommitted drafts as durable memory
- MCP tool registration (06)
