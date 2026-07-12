# Testing

## Test layers

### Domain tests

Run fast Vitest tests for:

- Frontmatter parsing and status transitions
- Branded identifiers and branch-name validation
- Permission decisions
- Proposal state transitions
- Comment anchor schemas
- Provider configuration decoding
- Tagged error mapping

Use fast-check for parsers, state transitions, branch names, path validation, and Markdown transformations.

### Markdown compatibility tests

Maintain fixture-based golden tests for every supported Markdown feature.

```text
Markdown fixture
  -> parse into Tiptap/ProseMirror
  -> serialize back to Markdown
  -> parse both into normalized syntax trees
  -> compare meaning and frontmatter
```

Unsupported syntax must produce an explicit result. Tests must detect silently dropped content.

### Editor tests

Use jsdom for command and document-state tests. Use browser tests for `contentEditable`, selections, keyboard behavior, paste, comments, and accessibility.

Required cases include:

- Metadata and body editing remain separate.
- Save state changes from clean to dirty and back.
- Reconnecting does not duplicate content.
- Pasted unsupported content is normalized or rejected visibly.

### CRDT and Durable Object tests

Use Cloudflare's Vitest integration where possible.

- Two clients make concurrent edits and converge.
- Updates are idempotent and tolerate reordered delivery.
- Server-side bootstrap runs once.
- Durable Object eviction restores the same document.
- WebSocket reconnect resynchronizes missed updates.
- Awareness appears and expires without entering durable content.
- Snapshot compaction preserves document state.
- A deployment-style disconnect does not lose acknowledged edits.
- Dirty rooms enter conflict state after an external push.

### Artifacts integration tests

Run tests against an isolated Artifacts repository and stage.

- Create or recover the workspace repository.
- Commit an RFD to main.
- Read the file and history back.
- Create and update a proposal branch.
- Compare source and proposal.
- Merge a clean proposal.
- Reject a stale expected parent.
- Clone with a short-lived read token.
- Confirm expired and revoked tokens fail.

Integration tests clean up only repositories and stages they created.

### D1 tests

- Apply migrations from an empty database.
- Create OAuth users and rotate sessions.
- Enforce one or more authors per RFD.
- Check role-based operations.
- Create, reply to, resolve, and age comment anchors.
- Deduplicate repeated Artifacts events.
- Enforce quotas transactionally.
- Encrypt and delete persistent user credentials when that option is enabled.

### Supermemory contract tests

Run the same suite against fake, hosted-test, and self-hosted adapters where available.

- Index a committed RFD with complete provenance.
- Search within the configured workspace scope.
- Exclude draft and proposal content.
- Reindex a changed commit without losing history unexpectedly.
- Surface provider failures as typed errors.
- Rebuild from Artifacts.

### Proposal model contract tests

Run deterministic tests through a fake model layer and smoke tests against Workers AI.

- Reject edits outside the allowed path.
- Reject malformed frontmatter.
- Reject oversized output.
- Preserve source branch content.
- Include cited memory provenance in the prompt.
- Enforce deployer and user quotas.
- Keep user-funded credentials out of logs and responses.

### End-to-end tests

Cover the MVP path in a real browser:

1. Sign in through a test identity provider or controlled OAuth fixture.
2. Create an RFD and become its author.
3. Open it in two browser contexts.
4. Make concurrent edits and observe presence.
5. Checkpoint and verify the Artifacts commit.
6. Create an AI proposal with retrieved memory context.
7. Comment on its diff.
8. Merge it and verify the public reader.
9. Push an external Git change and verify clean reload or dirty conflict behavior.

## Validation commands

Run repository checks through Vite+:

```sh
vp check
vp test
vp run -r build
```

Infrastructure integration tests may deploy real Cloudflare resources. They require explicit confirmation and isolated stages.

## Release gates

- No supported Markdown fixture loses semantic content.
- CRDT convergence and eviction recovery tests pass.
- Artifacts checkpoint and stale-parent tests pass against Cloudflare.
- Authorization tests cover every mutation endpoint.
- Secret scanning and log-redaction tests pass.
- The full public reader and editor paths pass desktop and mobile browser tests.
- `vp check`, `vp test`, and required builds pass.
