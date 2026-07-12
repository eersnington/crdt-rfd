# Foundation progress

## Status

`in-progress`

## Checklist

- [x] Create `packages/infra`.
- [x] Install exact Alchemy v2 and Effect v4 dependencies.
- [x] Add root infrastructure scripts.
- [x] Add one-bucket `alchemy.run.ts`.
- [ ] Obtain deploy confirmation.
- [ ] Run `bun alchemy deploy`.
- [ ] Confirm the R2 bucket is live.
- [ ] Record the deployment.
- [ ] Add shared domain schemas and tagged errors.
- [ ] Add frontmatter parser and serializer.
- [ ] Add D1 through Alchemy after the initial deploy gate.
- [ ] Add base migrations.
- [ ] Add GitHub OAuth and sessions.
- [ ] Add authorization evaluator and membership service.
- [ ] Add domain, migration, auth, and authorization tests.
- [ ] Run `vp check`, `vp test`, and affected builds.

## Blockers

Initial R2 deployment awaits explicit user confirmation.

## Implementation notes

Add dated notes here when a schema, provider, or deployment decision changes.

- 2026-07-12: Pinned the current Alchemy v2 getting-started dependencies and added an isolated Effect-style stack containing only the onboarding R2 bucket. No deployment has occurred.

## Validation evidence

| Date       | Command or check                                                                                                          | Result                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-07-12 | `vp install`                                                                                                              | Passed; workspace dependencies were current before implementation.                                    |
| 2026-07-12 | `bun run typecheck` in `packages/infra`                                                                                   | Passed.                                                                                               |
| 2026-07-12 | `vp check packages/infra/alchemy.run.ts packages/infra/package.json packages/infra/tsconfig.json package.json .gitignore` | Passed.                                                                                               |
| 2026-07-12 | `vp test`                                                                                                                 | Passed: 1 file and 1 test.                                                                            |
| 2026-07-12 | `vp run -r build`                                                                                                         | Passed for the web app and utils package.                                                             |
| 2026-07-12 | `vp run @crdt-rfd/infra#plan`                                                                                             | Passed: exactly one `FoundationBucket` create operation. No resources deployed.                       |
| 2026-07-12 | `vp check`                                                                                                                | Existing formatting failures remain in 17 specification files; no foundation source failure reported. |
