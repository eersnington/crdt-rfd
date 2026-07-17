# RFD Artifact PRD

## Goal

Implement one Cloudflare Artifacts Git repository per RFD, with catalog listing, read, checkpoint, history, fork, and clone tokens.

## Dependencies

- `01-foundation`: domain schemas, auth, Alchemy package.

## Repository model

Deployment binds one Artifacts namespace. Each RFD gets its own repo:

```text
name: rfd-{rfdId}
primary file: rfd.md
default branch: main
```

D1 holds the public catalog and membership. Artifacts holds committed Markdown and Git history.

## Deliverables

### Infrastructure binding

- Declare Artifacts namespace binding in Alchemy / Worker config as `ARTIFACTS`.
- Generate binding types; treat generated types as runtime source of truth.
- Document closed-beta access requirement and remote Artifacts for local dev.

### Effect service

Implement `RfdRepository` without leaking binding or isomorphic-git types to callers:

```ts
interface RfdRepository {
  create(input: CreateRfdInput): Effect<RfdSummary, RepositoryError>
  read(id: RfdId, ref?: GitRef): Effect<CommittedRfd, RepositoryError>
  history(id: RfdId, limit: number): Effect<ReadonlyArray<CommitSummary>, RepositoryError>
  checkpoint(input: CheckpointInput): Effect<CommitResult, RepositoryError>
  fork(input: ForkRfdInput): Effect<RfdSummary, RepositoryError>
  mintCloneToken(input: CloneTokenInput): Effect<CloneCredential, RepositoryError>
}
```

Also implement or extend `RfdCatalog` for public list and metadata updates.

Tagged errors include `RepositoryUnavailable`, `RfdNotFound`, `ArtifactNotReady`, `InvalidCommittedDocument`, `ForkFailed`, `Unauthorized`.

### Create

1. Allocate `RfdId` and number.
2. `env.ARTIFACTS.create("rfd-{id}", { setDefaultBranch: "main", description })`.
3. isomorphic-git: init MemoryFS, write `rfd.md` with validated frontmatter + body, commit, push to `created.remote` with initial token (strip `?expires=` for Basic auth password).
4. Insert D1 catalog row and owner membership.
5. Discard tokens after the operation.

### Read and list

- Public list from D1 catalog (not `ARTIFACTS.list` alone).
- Read body via Git fetch of the RFD's remote or binding tree/commit helpers where sufficient.
- Validate frontmatter before returning.

### Checkpoint

- Input: RFD id, Markdown body, frontmatter, expected base SHA when available.
- Mint short-lived write token for that repo only.
- Commit and push with isomorphic-git.
- Update catalog `headSha` and `updatedAt`.
- Map conflicts / rejected pushes to tagged errors; do not force-push.

### Fork

- `const source = await ARTIFACTS.get(sourceRepoName)`.
- `source.fork("rfd-{newId}", { defaultBranchOnly: true })`.
- New D1 catalog row: owner = forker, `forkedFrom` set.
- Do not copy D1 memberships from the source.

### Clone tokens

- Authz required.
- Default scope `read`, short TTL.
- Never return write tokens to browser code.
- Audit issuance (user, repo, scope, expiry) without storing plaintext long-term if avoidable.

## API surface

```text
GET  /api/rfds
GET  /api/rfds/:id
GET  /api/rfds/:id/history
POST /api/rfds
POST /api/rfds/:id/fork
POST /api/rfds/:id/checkpoint
POST /api/rfds/:id/clone-token
```

Exact RPC vs HTTP shape may follow existing Effect RPC patterns in the app.

## Suggested file ownership

```text
packages/repository/
packages/infra/  (Artifacts binding)
apps/web/src/server/rfds/
apps/web/src/routes/  (list loader uses catalog)
```

Do not implement the editor room, comments UI, Supermemory, or Code Mode here.

## Tests

- Fake repository contract tests.
- Live isolated create + push + read + fork + history (confirmed).
- Token secret stripping for Git auth.
- Unauthorized checkpoint/fork denied.
- Invalid Markdown rejected before push.

## Acceptance criteria

- Create RFD yields a ready Artifacts repo and public catalog entry.
- Checkpoint updates only that RFD's repository.
- Fork produces a new owned RFD with independent history.
- Public list does not require scanning a monorepo.
- No R2 or second durable store used as Git backend.
- `vp check` and `vp test` pass for changed packages.

## Out of scope

- Yjs / Tiptap
- Comment threads
- Memory indexing
- MCP / Code Mode
- Release automation
