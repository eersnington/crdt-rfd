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
- [x] Add D1 through Alchemy after the initial deploy gate.
- [x] Add base migrations.
- [x] Add GitHub OAuth and sessions.
- [x] Add authorization evaluator and membership service.
- [x] Add domain, migration, auth, and authorization tests.
- [x] Run `vp check`, `vp test`, and affected builds.

## Blockers

Initial R2 deployment awaits explicit user confirmation.

## Implementation notes

Add dated notes here when a schema, provider, or deployment decision changes.

- 2026-07-12: Pinned the current Alchemy v2 getting-started dependencies and added an isolated Effect-style stack containing only the onboarding R2 bucket. No deployment has occurred.
- 2026-07-13: Added the deferred Website D1 binding, base identity/session/authorization migration, Effect service boundaries, pure in-memory implementations, D1 adapters, and local migration/auth tests. No deployment has occurred.

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
| 2026-07-13 | `vp test`                                                                                                                 | Passed: 5 files and 82 tests, including migration, OAuth, session, linking, and membership tests.     |
| 2026-07-13 | `vp run -r build`                                                                                                         | Passed for domain, utils, and the web application.                                                    |
| 2026-07-13 | Focused `vp check --fix`                                                                                                  | Passed for all changed source, test, manifest, and infrastructure files.                              |
| 2026-07-13 | `vp check`                                                                                                                | Existing formatting failures remain in generated `routeTree.gen.ts` and 15 unrelated spec files.      |
