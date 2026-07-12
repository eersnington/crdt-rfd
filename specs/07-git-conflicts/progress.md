# Git conflicts progress

## Status

`not-started`

## Checklist

- [ ] Add Artifacts push event subscription through Alchemy.
- [ ] Add D1 event idempotency migration if not already present.
- [ ] Validate and filter incoming events.
- [ ] Detect changed RFD paths between commits.
- [ ] Notify and reload clean document rooms.
- [ ] Preserve dirty rooms and enter conflict state.
- [ ] Build conflict inspection UI.
- [ ] Implement use-remote flow with explicit confirmation.
- [ ] Implement preserve-local-as-proposal flow.
- [ ] Implement manual reconciliation checkpoint flow.
- [ ] Protect merges with reviewed source and proposal heads.
- [ ] Trigger idempotent main-branch memory indexing.
- [ ] Add event, conflict, merge-protection, and live integration tests.
- [ ] Run `vp check`, `vp test`, and affected builds.

## Blockers

- Requires stable repository, room, memory, and proposal contracts.

## Implementation notes

Record Artifacts event schema versions and reconciliation edge cases here.

## Validation evidence

| Date | Command or check | Result |
| --- | --- | --- |
| | | |
