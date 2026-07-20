# Security

## Trust boundaries

The browser is untrusted. It talks only to application HTTP/RPC endpoints and document-room WebSockets.

Host Worker is trusted with:

- Artifacts binding and short-lived repo tokens
- D1 and Durable Objects
- Decrypted user provider credentials for outbound calls
- Worker Loader (creates sandboxes)

Dynamic Worker sandboxes are untrusted code execution environments. They receive capability stubs only.

External boundaries:

- GitHub OAuth (Better Auth)
- Cloudflare Artifacts Git remotes and control plane
- User Supermemory (hosted or self-hosted)
- User AI providers
- Remote MCP clients
- Optional Artifacts event delivery

## Authentication

GitHub OAuth identifies users. Sign-in does not grant edit rights on every RFD. Membership and public comment policy authorize actions.

Sessions use secure, HTTP-only, same-site cookies. Session tokens are stored hashed in D1.

## Authorization

Check authorization for every mutation:

- Create RFD
- Connect to document room for edit
- Checkpoint
- Comment or resolve
- Manage membership / comment policy
- Mint Git tokens
- Configure personal providers
- MCP tool invocations (as the OAuth user)
- Code Mode connector methods (as the session user)

The Durable Object receives verified identity from the application Worker. It does not trust role claims from the browser.

## Public access

Public readers receive committed content and catalog list data only. Live Yjs drafts are not public unless product rules explicitly allow (MVP: drafts require room access as member/editor).

Clone tokens are short-lived and repo-scoped. Prefer `read`. Issue `write` only for authorized server-side checkpoint or user-authorized Git workflows. Browser routes never return a write token.

## Artifacts token handling

- Mint per operation with short TTL.
- For Git Basic auth, use token secret only (strip `?expires=` metadata when present).
- Revoke when practical after use for write tokens.
- Never log plaintext tokens.

## Agent confinement

### MCP

- OAuth binds tools to a user.
- Tools call the same Effect services as the web app.
- Do not expose a raw "run arbitrary Git" tool.
- Prefer a small goal-oriented tool set.

### Code Mode + Dynamic Workers

- Model-generated code runs in an isolated Worker via `DynamicWorkerExecutor`.
- Default: block outbound network (`globalOutbound: null`).
- Connectors run on the host and enforce authz before side effects.
- Do not put Artifacts bindings, Supermemory keys, or AI keys into sandbox `env`.
- Use `requiresApproval` for create/fork/checkpoint/comment when human confirmation is required.
- Approval replay must remain deterministic (sequential connector calls; `codemode.step` for nondeterminism).

## User provider secrets

- Encrypt AI and Supermemory keys with AES-GCM before D1 storage.
- Keep encryption key in Worker secret / Secrets Store.
- Record key version, IV, ciphertext, createdAt, lastUsedAt.
- Provide replace and delete operations.
- Decrypt only for the outbound request on the host.

## Supermemory endpoints

- Hosted: fixed Supermemory API origin.
- Self-hosted: user-configured base URL; validate URL shape; require HTTPS outside explicit local development allowlist (`localhost` / `127.0.0.1`).
- Scope all reads/writes to `containerTag` for that user.
- Prefer scoped keys when the user can generate them for a single container.

## Git safety

- Validate artifact repo names against catalog ownership.
- Never write outside the RFD's repository.
- Validate Markdown and frontmatter before commit.
- Bound document and diff sizes for Worker memory.

## Logging redaction

Never log:

- Document bodies and prompts in full
- OAuth tokens
- Artifacts tokens
- Supermemory API keys
- User AI credentials
- Authorization headers
