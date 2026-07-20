# Foundation progress

## Status

`complete`

## Checklist

- [x] Create `packages/infra`.
- [x] Install exact Alchemy v2 and Effect v4 dependencies.
- [x] Add root infrastructure scripts.
- [x] Add the Alchemy composition root.
- [x] Verify R2, D1, and Website resources in Alchemy development.
- [x] Deploy R2, D1, and Website resources to production.
- [x] Bind the Website to the custom domain derived from `APP_ORIGIN`.
- [x] Verify production HTML, CSS, and JavaScript asset delivery.
- [x] Load development and production env files explicitly from `apps/web`.
- [x] Add shared domain schemas and tagged errors.
- [x] Add frontmatter parser and serializer.
- [x] Add D1 through Alchemy after the initial deploy gate.
- [x] Add base migrations.
- [x] Add GitHub OAuth and sessions.
- [x] Add authorization evaluator and membership service.
- [x] Add domain, migration, auth, and authorization tests.
- [x] Run `vp check`, `vp test`, and affected builds.

## Blockers

None.

## Implementation notes

Add dated notes here when a schema, provider, or deployment decision changes.

- 2026-07-18: Product specs rewritten: per-RFD Artifacts, user BYO memory/AI, MCP/Code Mode. Foundation remains complete; domain roles and monorepo-oriented types need a later migration pass (not foundation rework).

- 2026-07-12: Pinned the current Alchemy v2 getting-started dependencies and added an isolated Effect-style stack containing only the onboarding R2 bucket. No deployment has occurred.
- 2026-07-13: Added the deferred Website D1 binding, base identity/session/authorization migration, Effect service boundaries, pure in-memory implementations, D1 adapters, and local migration/auth tests. No deployment has occurred.
- 2026-07-13: Per user direction, application resources and local-development wiring were completed before deployment verification. Added Better Auth request routes for GitHub login, callback, and logout.
- 2026-07-17: Kept Better Auth as the OAuth/session owner behind one Effect service boundary. Added a Drizzle adapter wrapper that stores SHA-256 session-token digests and hashes token predicates for reads, updates, and deletion. Each OAuth login issues a fresh session; future privilege-changing endpoints must rotate or revoke sessions when they are introduced.
- 2026-07-17: Disabled Better Auth's token-based list-session and selective-revocation endpoints because one-way digests cannot safely implement their bearer-token contract. Normal sign-out and revoke-all behavior remain available; selective management requires a future session-ID API.
- 2026-07-17: Tightened domain brands, Git refs, paths, dates, proposal states, and serializable errors; enforced the initial-author database invariant; and added production RPC plus OAuth/session integration coverage.
- 2026-07-17: Confirmed the Alchemy resources work in development. Moved application env ownership to `apps/web`; development uses `.env`, while plan, deploy, and destroy use `.env.production` through Alchemy's explicit `--env-file` option.
- 2026-07-17: Deployed the production stack with the Website custom domain derived from `APP_ORIGIN`. Disabled Worker-first static asset routing for TanStack Start after verifying that it caused deployed CSS and JavaScript requests to return the SSR 404 response.

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
| 2026-07-13 | `vp test`                                                                                                                 | Passed: 5 files and 82 tests.                                                                         |
| 2026-07-13 | `vp run -r build`                                                                                                         | Passed for domain, utils, and the TanStack Start application.                                         |
| 2026-07-13 | Focused `vp check`                                                                                                        | Passed for all foundation source, tests, manifests, and progress files.                               |
| 2026-07-17 | `vp install`                                                                                                              | Passed; removed the unused shadcn CLI and refreshed the lockfile.                                      |
| 2026-07-17 | `vp check`                                                                                                                | Passed formatting, lint, and type checking for the full repository.                                   |
| 2026-07-17 | `vp test`                                                                                                                 | Passed: 11 files and 97 tests, including OAuth, hashed sessions, RPC transport, domain, and migration. |
| 2026-07-17 | `vp run -r build`                                                                                                         | Passed for domain, utils, and the TanStack Start application.                                         |
| 2026-07-17 | `vp run -r plan`                                                                                                          | Passed: Website update only; R2 and D1 unchanged.                                                      |
| 2026-07-17 | Alchemy production deploy                                                                                                 | Passed: Website assets and Worker uploaded; custom domain reconciled.                                  |
| 2026-07-17 | Live HTTP checks                                                                                                          | Passed: HTML returned `200 text/html`, CSS `200 text/css`, and JavaScript `200 text/javascript`.        |
