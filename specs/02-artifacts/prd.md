# Artifacts PRD

## Goal

Implement the single Cloudflare Artifacts repository that stores committed RFD Markdown, history, branches, clone credentials, diffs, and merges.

## Dependencies

- `01-foundation`: domain schemas, authorization, and the Alchemy package.

## Repository model

One deployment owns one repository in its configured Artifacts namespace:

```text
/rfds/
  0001-request-for-discussion.md
/assets/
/workspace.json
```

The deployment owns repository infrastructure. Individual users own RFDs through D1 memberships.

## Deliverables

### Infrastructure binding

- Declare the Artifacts namespace binding in Alchemy.
- Bind it to the TanStack Start server Worker as `ARTIFACTS`.
- Generate binding types and treat them as the runtime source of truth.
- Configure remote Artifacts access for local development where required.

### Repository bootstrap

- Add an owner-only bootstrap operation that creates the workspace repository when absent.
- Initialize `main`, `workspace.json`, and the `rfds/` layout in one commit.
- Make bootstrap idempotent and safe to retry.
- Store the repository name in deployment configuration, not user input.

### Effect service

Implement `RfdRepository` without leaking `env.ARTIFACTS` or `isomorphic-git` types into callers.

```ts
interface RfdRepository {
  list(ref?: GitRef): Effect<ReadonlyArray<RfdSummary>, RepositoryError>
  read(id: RfdId, ref?: GitRef): Effect<CommittedRfd, RepositoryError>
  history(id: RfdId, limit: number): Effect<ReadonlyArray<CommitSummary>, RepositoryError>
  checkpoint(input: CheckpointInput): Effect<CommitResult, RepositoryError>
  createBranch(input: CreateBranchInput): Effect<BranchResult, RepositoryError>
  compare(input: CompareInput): Effect<RfdDiff, RepositoryError>
  merge(input: MergeInput): Effect<MergeResult, RepositoryError | MergeConflict>
  mintCloneToken(input: CloneTokenInput): Effect<CloneCredential, RepositoryError>
}
```

Use tagged errors such as `RepositoryUnavailable`, `RfdNotFound`, `BranchNotFound`, `BranchAdvanced`, `InvalidCommittedDocument`, and `MergeConflict`.

### Git operations

- Use `env.ARTIFACTS` to get the repository and mint request-scoped tokens.
- Use transient `isomorphic-git` state to fetch, commit, branch, compare, merge, and push.
- The transient filesystem is an operation buffer, not durable storage.
- Fetch only required refs and shallow history when possible.
- Materialize only relevant RFD and metadata files.
- Push against an expected parent SHA.
- Never force-push `main`.
- Discard repository tokens and transient state after the scoped Effect completes.

### Public reads

- Add server functions for listing and reading committed main-branch RFDs.
- Cache rendered public responses using commit SHA as the immutable cache key.
- Parse and validate every committed RFD before returning it to the reader.
- Return actionable diagnostics for an invalid repository document without exposing secrets.

### Clone credentials

- Require authentication and explicit authorization before minting a token.
- Return read-only, short-lived credentials by default.
- Never expose a write token to browser code.
- Audit token issuance with user, repository, scope, and expiry metadata.

## API surface

```text
GET  /api/rfds
GET  /api/rfds/:id
GET  /api/rfds/:id/history
POST /api/rfds/:id/clone-token
```

Checkpoint, proposal, and merge endpoints are added by dependent workstreams.

## Suggested file ownership

```text
packages/repository/
packages/infra/src/artifacts.ts
apps/web/src/server/rfds/
apps/web/src/routes/api.rfds.*
```

Do not implement the editor, Yjs room, Supermemory indexing, or AI generation here.

## Tests

- Fake `RfdRepository` contract tests for application callers.
- Live isolated-stage integration test creating a repository and initial commit.
- Read, history, branch, commit, compare, and clean merge tests.
- Stale expected-parent test that returns `BranchAdvanced` and preserves remote state.
- Clone test with a short-lived read token.
- Expired and revoked token tests.
- Path traversal and unexpected file-mode tests.
- Memory-bound test using a representative workspace size.

Live tests deploy or create resources only after confirmation and clean up only their own stage and repository.

## Acceptance criteria

- The application can create or recover one workspace repository.
- Public APIs read validated main-branch RFDs from Artifacts.
- A checkpoint creates a normal Git commit and advances only the expected ref.
- Proposal refs can be created, compared, and merged.
- Standard Git tooling can clone the repository with a minted read token.
- No R2, ArtifactFS, GitHub repository, or second persistent repository store is used.
- `vp check`, `vp test`, affected builds, and confirmed live integration tests pass.

## Out of scope

- CRDT serialization and checkpoint triggers
- Proposal model invocation
- External push event processing
- Per-user repositories
