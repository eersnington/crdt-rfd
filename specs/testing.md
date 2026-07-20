# Testing

## Principles

- Prefer Effect-friendly unit tests for pure domain logic.
- Use fakes for Effect services at application boundaries.
- Use live Cloudflare tests only for isolated stages after confirmation.
- Never assert on secrets or log secret material.

## Domain and authorization

- Role permission matrix: owner, editor, commenter, public reader.
- Comment policy anyone vs members-only.
- Ownership transfer keeps at least one owner.
- Frontmatter parse/serialize and status transitions.
- Container tag and customId formats for memory provenance.

## Artifacts / repository service

Contract tests with a fake `RfdRepository`:

- create RFD catalog + artifact name
- read committed Markdown
- checkpoint advances head
- fork creates new id + new repo name + forkedFrom
- mint read token; reject unauthorized write token mint

Live integration (isolated namespace/stage, confirmed):

- `ARTIFACTS.create` + isomorphic-git initial push
- `repo.fork`
- `repo.log` history
- token strip for `?expires=` Git auth
- cleanup only self-created repos

## Editor / CRDT

- Markdown golden fixtures for supported subset.
- Unsupported syntax validation visibility.
- Yjs multi-client convergence property tests where practical.
- Room bootstrap from Artifact head.
- Checkpoint from dirty room updates base SHA.
- Conflicted state when remote advances under a dirty room (when events exist).

## Comments

- Create thread, reply, resolve.
- Relative position survival across concurrent inserts.
- Outdated anchor when range cannot resolve.
- Unauthorized comment rejected under members-only.

## Memory and chat

- Off mode: chat/index no-ops without breaking core app.
- Hosted and self-hosted fake servers: add with containerTag + customId.
- Search scoped to user container only.
- Interaction gating: only interacted RFDs indexed for that user.
- Credential encryption round-trip; no plaintext in logs.

## Agents

- MCP tool authz mirrors HTTP/RPC authz.
- MCP OAuth session maps to application user.
- Code Mode connector calls host services, not raw bindings.
- Approval pause/resume for a mutation tool.
- Sandbox cannot read env secrets (negative test where feasible).
- Error statuses returned as data, not uncaught throws through the model tool.

## End-to-end MVP path

1. Public list empty or fixture-free against real catalog.
2. Sign in, create RFD, open editor.
3. Second user invited as editor; co-edit; checkpoint.
4. Comment as third user under `anyone` policy.
5. Fork RFD; verify new owner and independent Artifact.
6. Configure memory + AI (test doubles); interact; chat returns citation.
7. Call MCP `get_rfd` / `list_rfds` as the user.
8. Run one Code Mode plan that lists and summarizes via connectors.

## Commands

Use Vite+ toolchain:

- `vp check`
- `vp test`
- `vp run` scripts as defined in package manifests

Live Artifacts or production resources require explicit confirmation before create/destroy.
