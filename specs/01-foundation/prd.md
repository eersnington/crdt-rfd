# Foundation PRD

## Superseded assumptions

This workstream is **complete**. Later product decisions supersede some original assumptions:

- Committed storage is **one Artifacts repository per RFD**, not one monorepo for all RFDs.
- Supermemory and AI keys are **user BYO**, not deployer-only configuration.
- Agents include **MCP + Code Mode + Dynamic Workers** (workstream 06).
- Roles target **owner / editor / commenter** (migrate from author / coauthor / reviewer when implementing access).
- There is **no release polish workstream**.

Keep this PRD as the historical record of foundation deliverables. See `specs/index.md` for the current product model.

## Goal

Establish the Alchemy v2 deployment package, shared domain contracts, D1 schema, GitHub authentication, and authorization boundaries required by every later workstream.

## Dependencies

None. This workstream is the base of the stack.

## Deliverables

### Alchemy package

- Create `packages/infra` as an isolated workspace package.
- Install Alchemy v2, Effect v4, and the required Bun and Node platform packages.
- Add root scripts that delegate infrastructure commands to `packages/infra`.
- Add `packages/infra/alchemy.run.ts` as the composition root.
- Keep application env files under `apps/web` and select `.env` or `.env.production` explicitly
  from the corresponding Alchemy command.
- Verify the R2 bucket, D1 database, and Website resource through local Alchemy development and
  production deployment.
- Derive the Website custom domain from `APP_ORIGIN` rather than hard-coding deployment-specific
  hostnames.
- Serve Vite client assets before the TanStack Start Worker while preserving Worker handling for
  application routes.

The R2 bucket validates Alchemy setup only. It is not the Artifacts repository backend.

### Shared domain package

Create a package for provider-independent schemas and errors. Keep domain contracts free of Cloudflare bindings.

Implement Effect Schema definitions for:

- Branded IDs: `WorkspaceId`, `UserId`, `RfdId`, `RfdNumber`, `ProposalId`, `CommentThreadId`, `CommitSha`.
- Git values: `BranchName`, `GitRef`, and repository-relative `RfdPath`.
- RFD frontmatter and the closed status transition set.
- Workspace policy, roles, and permissions.
- Proposal, memory provenance, and comment anchor contracts needed by later workstreams.
- Tagged errors for validation, authorization, not-found, conflict, and provider failures.

Do not add speculative compatibility fields. Illegal states should use discriminated unions rather than optional booleans.

### Frontmatter boundary

- Parse YAML frontmatter separately from the Markdown body.
- Validate number, title, status, authors, dates, reviewers, supersedes, and related RFDs.
- Reject duplicate RFD numbers, invalid status values, and unsafe paths.
- Serialize frontmatter deterministically.
- Preserve unknown frontmatter only if the product explicitly allows it; the default is to reject unsupported fields with a useful diagnostic.

### D1 foundation

Add D1 through Alchemy and create migrations for:

```text
users
sessions
rfd_memberships
workspace_settings
```

Required constraints:

- GitHub account IDs are unique.
- An RFD must retain at least one author.
- Membership role values are constrained to the domain role set.
- Session tokens are stored as hashes, not plaintext.

### GitHub OAuth

- Implement GitHub OAuth with state and PKCE.
- Use secure, HTTP-only, same-site cookies.
- Rotate the session after login and privilege changes.
- Keep Better Auth construction behind one Effect service boundary. Better Auth owns the GitHub
  provider flow and session persistence internals; application code consumes a separate current-session
  projection rather than depending on Better Auth's response shape.
- Do not make GitHub repository access part of the requested OAuth scope.

### Authorization

Implement a pure permission evaluator and an Effect service for loading memberships.

Initial roles:

```text
workspace owner
coauthor
reviewer
```

Initial permissions:

```text
create-rfd
edit
checkpoint
comment
create-proposal
merge-proposal
manage-members
transfer-ownership
configure-workspace
```

Every mutation endpoint added later must call this evaluator. Authentication alone grants no edit permission.

## Suggested file ownership

```text
packages/infra/
packages/domain/
apps/web/src/server/auth/
apps/web/src/server/authorization/
apps/web/src/routes/auth.*
```

Avoid editing Artifacts, editor, comments, or proposal implementation files in this workstream.

## Tests

- Property tests for IDs, branch names, repository paths, and frontmatter parsing.
- Unit tests for every status transition and permission decision.
- Migration test from an empty D1 database.
- OAuth callback tests for state mismatch, expired state, provider denial, and account linking.
- Session creation, rotation, expiry, and logout tests.
- Test that ownership transfer cannot remove the last author.

## Acceptance criteria

- `packages/infra` starts the R2, D1, and Website resources in Alchemy development.
- Development and production commands load their corresponding env files from `apps/web`.
- Production deployment binds the Website to the hostname from `APP_ORIGIN`.
- Production HTML, CSS, and JavaScript assets return successful responses with the expected content
  types.
- Domain schemas compile without importing Cloudflare runtime types.
- D1 migrations apply cleanly from zero.
- GitHub login creates or reconnects a user without requesting repository scopes.
- Permission tests cover every defined role and operation.
- `vp check`, `vp test`, and affected builds pass.

## Out of scope

- Artifacts repository creation and Git operations
- The RFD reader and editor
- Durable Object collaboration
- Comments, Supermemory, and AI
- Multi-workspace tenancy
