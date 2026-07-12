# Agent proposals PRD

## Goal

Allow an authorized user to request an AI-generated alternative RFD, commit it to an isolated Artifacts branch, review its diff, request revisions, and merge or abandon it.

## Dependencies

- `01-foundation`: users, permissions, provider settings, and D1.
- `02-artifacts`: branch, commit, compare, and merge operations.
- `03-editor-crdt`: source checkpoint and proposal branch editing.
- `05-supermemory`: cited retrieval context.

## Provider and funding modes

```ts
type ProposalModelConfig =
  | { _tag: "DeployerWorkersAi"; model: AllowedModel }
  | { _tag: "UserWorkersAi"; model: AllowedModel; credentials: UserCredentialRef }
```

Deployment policy selects:

```text
user-only
deployer-or-user
```

Deployer-funded mode uses `env.AI`. User-funded mode uses the Workers AI REST endpoint with the user's Cloudflare account ID and scoped API token. Model names come from a deployment allowlist.

## Deliverables

### Effect services

Implement:

```ts
interface ProposalModel {
  generateRevision(input: ProposalPrompt): Effect<GeneratedRevision, ProposalModelError>
}

interface ProposalService {
  create(input: CreateProposal): Effect<Proposal, ProposalError>
  revise(input: ReviseProposal): Effect<Proposal, ProposalError>
  merge(input: MergeProposal): Effect<MergedProposal, ProposalError>
  abandon(input: AbandonProposal): Effect<void, ProposalError>
}
```

Provide fake, deployer Workers AI, and user Workers AI layers.

### D1 schema

Add a `proposals` migration containing:

- Proposal ID and RFD ID
- Requesting user
- Source branch and source commit
- Target branch and current head
- User instruction
- Selected provider and model metadata without secret values
- Generating, open, revising, merged, abandoned, or failed state
- Summary and failure diagnostic
- Creation and update timestamps

State transitions must be atomic and validated.

### Creation flow

1. Authorize proposal creation.
2. Checkpoint the active source branch.
3. Create a safe target branch name from the RFD and request.
4. Search Supermemory with a bounded query.
5. Build a prompt containing the checkpointed Markdown, cited context, instruction, and one allowed path.
6. Call the selected `ProposalModel` layer.
7. Validate output size, frontmatter, Markdown, and path restriction.
8. Commit the revision to the target branch.
9. Store summary and branch head in D1.
10. Return the source-to-target diff.

### Revision flow

- Checkpoint manual edits on the proposal branch before an AI revision.
- Include prior proposal summary and new user instruction.
- Commit each accepted revision to the proposal branch.
- Keep review comments tied to immutable comparison SHAs.
- Do not modify source branch content.

### Merge and abandon

- Require explicit human authorization.
- Check that source and proposal heads match the reviewed comparison.
- Perform a clean merge or return a typed conflict.
- Checkpoint and notify affected document rooms after merge.
- Mark abandoned proposals in D1 without deleting Git history by default.

### User-funded credentials

Initial support is session-only:

- Accept Cloudflare account ID and a narrowly scoped Workers AI token over an authenticated server action.
- Keep plaintext credentials in server-side session scope only.
- Never return credentials after submission.
- Clear credentials on logout and expiry.

Persistent credentials are optional follow-up work. If enabled, use AES-GCM envelope encryption and the policy in `../security.md`.

### Quotas

- Enforce per-user request and token budgets before provider calls.
- Separate deployer-funded and user-funded usage.
- Return a tagged quota error with the reset time and recovery action.
- Record model, provider mode, latency, and usage without prompts or secrets.

## API surface

```text
POST   /api/rfds/:id/proposals
GET    /api/rfds/:id/proposals/:proposalId
POST   /api/rfds/:id/proposals/:proposalId/revise
POST   /api/rfds/:id/proposals/:proposalId/merge
DELETE /api/rfds/:id/proposals/:proposalId
POST   /api/settings/workers-ai/session-credentials
DELETE /api/settings/workers-ai/session-credentials
```

## Suggested file ownership

```text
packages/proposals/
packages/infra/src/ai.ts
apps/web/src/components/proposals/
apps/web/src/routes/api.proposals.*
```

## Tests

- Proposal state-machine tests.
- Fake-model end-to-end tests for create, revise, merge, and abandon.
- Prompt tests proving citations and allowed paths are present.
- Output tests rejecting changed frontmatter, extra files, oversized content, and invalid Markdown.
- Test that source branch does not move during proposal generation.
- Authorization and reviewed-head mismatch tests.
- Deployer and user funding policy tests.
- Quota race and reset tests.
- Credential redaction and session-expiry tests.
- Workers AI smoke test in a confirmed isolated stage.

## Acceptance criteria

- An authorized user can create an alternative proposal from a checkpointed RFD.
- Supermemory context includes valid source citations.
- The generated result changes only the selected RFD on a proposal branch.
- The UI shows a readable source-to-proposal diff and summary.
- Revisions create additional proposal commits without changing source.
- A human can merge a clean reviewed proposal or receive a structured conflict.
- Deployer-only, user-only, and mixed funding policies behave as configured.
- `vp check`, `vp test`, affected builds, and confirmed provider smoke tests pass.

## Out of scope

- Autonomous merge
- Arbitrary repository tool access
- User-selected model endpoints
- Billing or payment processing by the application
- General-purpose coding agents
