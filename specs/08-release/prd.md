# Release PRD

## Goal

Make the platform safe to fork, deploy, operate, and validate with Alchemy stages, CI, observability, documentation, and release gates.

## Dependencies

- All feature workstreams.
- CI scaffolding may begin after `01-foundation` but final release gates depend on completed features.

## Deliverables

### Deployment configuration

Document and validate deployer choices:

- Workspace name and repository name
- GitHub OAuth application
- Initial owner identity
- Public proposal and comment visibility
- RFD creation policy
- Hosted, self-hosted, or disabled Supermemory
- Deployer-only, user-only, or mixed Workers AI funding
- Allowed Workers AI models
- Per-user quotas
- Custom domain when configured

Use Effect Config and redacted values for secrets. Alchemy credentials remain in profiles, not project environment instructions.

### Stages

- Development stages isolate D1, Durable Objects, Artifacts repository names, and queues.
- Preview stages use unique names and must not write to production Supermemory containers.
- Production uses stable resources and explicit approval.
- Destructive operations require a separate confirmation and clear resource list.

### Local development

- Support `bun alchemy dev` with TanStack Start HMR.
- Document remote Artifacts usage in development.
- Support local self-hosted Supermemory at a configured loopback URL.
- Provide fake memory and AI layers for deterministic development and tests.
- Seed a sample workspace and RFD without production credentials.

### CI/CD

- Run `vp install`, `vp check`, `vp test`, and recursive builds.
- Run browser tests against the built application.
- Run provider-independent contract tests on every PR.
- Run real Cloudflare integration tests only in approved protected jobs and isolated stages.
- Add per-PR preview deployment and cleanup after the core stack is stable.
- Never expose provider secrets to untrusted forked PR jobs.

### Observability

Add structured telemetry for:

- HTTP request and tagged error outcomes
- Document room connection, recovery, snapshot, and compaction
- Checkpoint and Git operation latency
- Push event handling and conflicts
- Supermemory indexing and search
- Proposal provider, model, funding mode, latency, and usage
- Quota denials and authorization failures

Redact documents, prompts, comments, OAuth tokens, Artifacts tokens, Supermemory keys, and user AI tokens.

### Operational tools

Provide owner-only diagnostics for:

- Artifacts repository connectivity
- D1 migration version
- Durable Object schema version
- Supermemory health
- Workers AI configuration
- Queue backlog or failed indexing work

Diagnostics return typed health states and recovery guidance.

### Documentation

- Root setup instructions linked to `specs/`.
- Alchemy login and first-deploy sequence.
- GitHub OAuth setup.
- Supermemory provider choices.
- AI funding choices and user credential risks.
- Backup and recovery based on Artifacts as canonical committed history.
- Upgrade and migration instructions.
- Known beta limitations for Artifacts.

### Accessibility and performance

- Keyboard navigation for editor, comments, diff, and dialogs.
- Screen-reader labels and visible focus states.
- Mobile reader and editor validation.
- Public reader performance budget.
- Bound initial editor and history payloads.
- Lazy-load editor and diff code from public reader routes.

## Release test matrix

- Fresh deployment from a fork.
- Existing deployment update without data loss.
- Hosted, self-hosted, and disabled memory modes.
- Deployer-only, user-only, and mixed AI funding.
- Public reader without authentication.
- Two-user realtime editing and checkpoint.
- Proposal generation, review comments, and merge.
- External push into clean and dirty rooms.
- Provider outage and recovery.
- Worker deployment during active collaboration.

## Acceptance criteria

- A new deployer can provision the platform using documented Alchemy commands and profiles.
- Every deploy remains confirmation-gated.
- PR checks run without cloud credentials where possible.
- Protected integration jobs use isolated stages and clean up their resources.
- Operational health endpoints identify failures without exposing secrets.
- Desktop and mobile MVP end-to-end tests pass.
- Security, accessibility, and log-redaction gates pass.
- `vp check`, `vp test`, recursive builds, and approved live integration suites pass.

## Out of scope

- Paid hosted service operations
- Multi-tenant billing
- Enterprise SSO
- Formal compliance certification
- Guaranteed zero-downtime migration across incompatible CRDT schemas
