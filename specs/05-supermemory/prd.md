# Supermemory PRD

## Goal

Index traceable knowledge from committed main-branch RFDs and expose semantic search and proposal context through a configurable Effect service.

## Dependencies

- `01-foundation`: schemas, secrets, D1, and infrastructure package.
- `02-artifacts`: committed file reads and Git provenance.
- `03-editor-crdt`: checkpoint completion events.

## Provider modes

```ts
type MemoryConfig =
  | { _tag: "Disabled" }
  | { _tag: "SupermemoryHosted"; apiKey: SecretRef }
  | { _tag: "SupermemorySelfHosted"; baseUrl: URL; apiKey: SecretRef }
```

- Hosted mode uses the fixed Supermemory API origin.
- Self-hosted development can use a loopback endpoint.
- Self-hosted production requires a deployer-configured endpoint reachable by the Worker.
- Disabled mode keeps reading, editing, Git, and manual proposal review operational.

## Deliverables

### Effect service

Implement a provider-independent `Memory` service:

```ts
interface Memory {
  indexCommit(input: IndexCommitInput): Effect<IndexResult, MemoryError>
  search(input: MemoryQuery): Effect<ReadonlyArray<MemoryHit>, MemoryError>
  removeCommit(input: RemoveCommitInput): Effect<void, MemoryError>
  health: Effect<MemoryHealth, MemoryError>
}
```

Provide `MemoryDisabled`, `SupermemoryHosted`, `SupermemorySelfHosted`, and deterministic fake layers.

### Provenance

Every indexed record must include:

- Workspace ID
- RFD ID and number
- Repository-relative file path
- Branch, fixed to `main` for organizational memories
- Commit SHA
- Section heading or stable section identifier
- Memory type
- Canonical public URL when available

Supported memory types:

```text
decision
assumption
constraint
rejected-alternative
open-question
relationship
superseded-decision
```

Search results lacking valid provenance are excluded from proposal context.

### Indexing pipeline

Trigger indexing after a successful main-branch checkpoint or external main push.

```text
commit event
  -> deduplicate by repository and commit SHA
  -> read validated RFD Markdown from Artifacts
  -> split by semantic section
  -> extract narrow memory records
  -> write records with provenance
  -> record indexing outcome
```

Use a queue or durable workflow if available through the selected Alchemy and Cloudflare versions. Delivery is at least once, so writes must be idempotent.

Do not index:

- Dirty CRDT drafts
- Proposal branches
- Comments
- Private notes
- Provider credentials
- Invalid committed documents

### Search

- Add semantic search for the public RFD site.
- Scope all searches to the deployment's configured workspace container.
- Support filters by memory type, RFD, and commit when the provider permits them.
- Return excerpts with source links and commit SHAs.
- Bound result count and content included in AI prompts.

### Rebuild and deletion

- Add an owner-only rebuild operation that walks reachable main history or the current main corpus according to policy.
- Preserve commit provenance when newer documents supersede prior decisions.
- Make hard deletion explicit. Normal updates should not erase historical reasoning automatically.

## API surface

```text
GET  /api/search?q=...
POST /api/admin/memory/rebuild
GET  /api/admin/memory/health
```

## Security

- Keep Supermemory keys server-side.
- Validate self-hosted origins at startup.
- Require HTTPS outside explicit local development.
- Reject arbitrary user-selected endpoints.
- Redact authorization headers and indexed document content from logs.
- Keep search scoped to the current workspace.

## Suggested file ownership

```text
packages/memory/
packages/infra/src/memory.ts
apps/web/src/server/search/
apps/web/src/routes/api.search.*
```

## Tests

- Contract tests shared by disabled, fake, hosted-test, and self-hosted-test layers.
- Provenance schema and invalid-result filtering tests.
- Index idempotency test for repeated commit events.
- Test that proposal branches, drafts, and comments are excluded.
- Search scope and result-bound tests.
- Provider timeout, rate-limit, malformed response, and unavailable tests.
- Rebuild test using a fixture Artifacts repository.
- Secret and log-redaction tests.

## Acceptance criteria

- A committed main RFD is indexed after checkpoint.
- Search returns relevant records with file and commit citations.
- Proposal branches and drafts never appear as organizational memory.
- Hosted, self-hosted, disabled, and fake layers satisfy the same contract.
- The memory index can be rebuilt from Artifacts.
- Provider failure does not corrupt committed RFD state.
- `vp check`, `vp test`, affected builds, and configured provider contract tests pass.

## Out of scope

- Provisioning a stateful self-hosted Supermemory server in Cloudflare Containers
- User-specific conversational memory
- Indexing arbitrary uploads or external connectors
- Treating Supermemory as canonical document storage
