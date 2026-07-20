# CRDT RFD Web

The TanStack Start application is built and deployed through the Alchemy composition root in
`packages/infra/alchemy.run.ts`.

## Environment

Keep application configuration beside this app:

- `.env` is used by `vp dev`.
- `.env.production` is used by `vp run infra:plan`, `vp run infra:deploy`, and
  `vp run infra:destroy`.
- `.env.example` and `.env.production.example` document the required keys.

The real env files are ignored by Git. Alchemy receives their paths explicitly through
`--env-file`; it does not discover them from the Vite `rootDir`.

Create a Better Auth secret with:

```sh
openssl rand -base64 32
```

GitHub OAuth callback URLs should match the selected `APP_ORIGIN`:

```text
<APP_ORIGIN>/api/auth/callback/github
```

## Commands

```sh
vp dev
vp run infra:plan
vp run infra:deploy
vp run infra:destroy
```
