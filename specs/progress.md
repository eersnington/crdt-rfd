# Progress

## Status values

- `not-started`: no implementation has begun
- `in-progress`: active work exists
- `blocked`: work cannot continue without a decision or dependency
- `complete`: acceptance criteria and required tests pass

## Overall status

| Area                         | Status      | Notes                                                                |
| ---------------------------- | ----------- | -------------------------------------------------------------------- |
| Product specification        | complete    | Initial implementation specification captured in `specs/`            |
| Alchemy foundation           | in-progress | One-bucket stack plans successfully; deployment confirmation pending |
| Domain model                 | in-progress | Foundation schemas and tagged errors are implemented                 |
| Authentication and ownership | in-progress | Better Auth, hashed sessions, and D1 authorization are implemented   |
| Artifacts repository         | not-started | Binding, bootstrap, and Git operations pending                       |
| Public reader                | in-progress | Fixture-backed index exists; Artifacts integration remains           |
| Editor and Markdown          | not-started | Tiptap round-trip spike required first                               |
| CRDT collaboration           | not-started | Yjs Durable Object pending                                           |
| Checkpointing                | not-started | Depends on editor and Artifacts integration                          |
| Comments                     | not-started | Depends on CRDT anchors and D1                                       |
| Proposals and diffs          | not-started | Depends on checkpointing and branch operations                       |
| Supermemory                  | not-started | Provider layers and indexing pending                                 |
| Workers AI                   | not-started | Funding policy and provider layers pending                           |
| External Git conflicts       | not-started | Depends on checkpointing and push events                             |
| Release and CI               | not-started | Preview stages and end-to-end tests pending                          |

## Workstream trackers

- [01 Foundation](./01-foundation/progress.md)
- [02 Artifacts](./02-artifacts/progress.md)
- [03 Editor and CRDT](./03-editor-crdt/progress.md)
- [04 Comments and review](./04-comments-review/progress.md)
- [05 Supermemory](./05-supermemory/progress.md)
- [06 Agent proposals](./06-agent-proposals/progress.md)
- [07 Git conflicts](./07-git-conflicts/progress.md)
- [08 Release](./08-release/progress.md)

## Stacked PRs

| PR  | Deliverable                                                        | Dependencies | Status      |
| --- | ------------------------------------------------------------------ | ------------ | ----------- |
| 01  | `packages/infra`, Alchemy v2, one R2 bucket, confirmed deployment  | none         | in-progress |
| 02  | Domain schemas, errors, frontmatter parser, Markdown fixtures      | 01           | in-progress |
| 03  | D1 migrations, GitHub OAuth, ownership and authorization           | 02           | in-progress |
| 04  | Artifacts binding, repository bootstrap, read and write operations | 02           | not-started |
| 05  | Public RFD index and reader backed by Artifacts                    | 04           | in-progress |
| 06  | Tiptap Markdown round-trip spike and supported syntax policy       | 02           | not-started |
| 07  | Single-user WYSIWYG editor and metadata controls                   | 05, 06       | not-started |
| 08  | Yjs Durable Object, WebSocket transport, server bootstrap          | 03, 07       | not-started |
| 09  | CRDT persistence, compaction, reconnect, presence, cursors         | 08           | not-started |
| 10  | Validated checkpoints from Yjs to Artifacts                        | 04, 09       | not-started |
| 11  | D1 comments with Yjs and diff anchors                              | 03, 09       | not-started |
| 12  | Proposal branches, diffs, manual revisions, merge, abandon         | 10           | not-started |
| 13  | Memory Effect service, hosted/self-hosted Supermemory, indexing    | 10           | not-started |
| 14  | ProposalModel layers, funding policy, AI proposal generation       | 12, 13       | not-started |
| 15  | Artifacts push events and conflict resolution                      | 10, 13       | not-started |
| 16  | Preview stages, CI, observability, security and E2E gates          | 11, 14, 15   | not-started |

## Parallel work lanes

After PR 02:

- PR 03: authentication and D1
- PR 04: Artifacts repository service
- PR 06: editor and Markdown spike
- Reader visual work from PR 05 can begin against fixtures

After PR 09:

- PR 10: checkpointing
- PR 11: comments
- Supermemory adapter contract work from PR 13

After PR 12:

- PR 13: indexing integration
- PR 15: external push handling
- AI provider contract work from PR 14

## Decisions still requiring confirmation

- Whether tables belong in the supported Markdown subset after the editor spike.
- Whether anonymous users can comment or comments always require GitHub login.
- Whether proposals are public before merge.
- Whether persistent user-funded Workers AI credentials are needed after session-only support.
- Which Workers AI models the deployment allows by default.

## Deployment log

Record each confirmed infrastructure operation here.

| Date | Stage | Command | Result | Resources |
| ---- | ----- | ------- | ------ | --------- |
|      |       |         |        |           |
