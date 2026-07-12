# Security

## Trust boundaries

The browser is untrusted. It communicates only with authenticated application endpoints and document-room WebSockets. Provider credentials and Artifacts write tokens remain server-side.

External boundaries include:

- GitHub OAuth
- Cloudflare Artifacts Git remotes
- Hosted or self-hosted Supermemory
- Workers AI binding or REST API
- Artifacts event delivery

Every boundary validates identity, authorization, payload shape, and size.

## Authentication

GitHub OAuth identifies users. Successful authentication does not grant edit access automatically. Workspace policy and RFD memberships determine authorization.

Sessions are stored in D1 with secure, HTTP-only, same-site cookies. State and PKCE protect the OAuth exchange. Session rotation follows login and privilege changes.

## Authorization

Authorization is checked for every mutation:

- Create RFD
- Edit and connect to a document room
- Checkpoint
- Comment or resolve a thread
- Create or revise a proposal
- Mint a Git token
- Merge or abandon a proposal
- Manage RFD membership
- Configure providers

The Durable Object receives verified identity and permissions from the application Worker. It does not trust role claims sent by the browser.

## Public access

Public readers receive committed main-branch content only. Draft Yjs state, proposal branches, comments, and history visibility follow workspace policy.

Clone tokens are short-lived and read-only unless an explicitly authorized operation requires write access. Browser routes never return a write token.

## Agent confinement

Proposal generation receives:

- Current committed and checkpointed RFD Markdown
- A bounded set of cited memories
- One allowed file path
- Source and target branch names
- The user's instruction

The model returns content, not Git commands. Application code validates the output and performs the commit. The model cannot access repository credentials, D1, Durable Objects, or provider settings.

## User-funded Workers AI

Users may supply a Cloudflare account ID and a Workers AI API token with the narrowest available permission.

Initial support is session-only. If persistent credentials are enabled later:

- Encrypt tokens with AES-GCM before writing to D1.
- Keep the encryption key in a Worker secret or Secrets Store.
- Record key version, IV, ciphertext, creation date, and last use.
- Never log plaintext credentials.
- Provide deletion and replacement operations.
- Decrypt only for the outgoing Workers AI request.

The application controls the Workers AI base URL and model allowlist. User input cannot select an arbitrary outbound URL.

## Supermemory endpoints

Hosted mode uses the fixed Supermemory API origin. Self-hosted mode is configured by the deployer, not by end users.

Production validation requires HTTPS, rejects embedded credentials, and uses an origin allowlist. Local development can explicitly permit `localhost` or `127.0.0.1`. Error and telemetry output must redact authorization headers and indexed content.

## Git safety

- Validate repository paths against the selected RFD.
- Reject traversal, absolute paths, symlinks, submodules, and unexpected file modes.
- Use an expected parent SHA for every push.
- Restrict generated branch names to a safe format.
- Limit commit, Markdown, and diff sizes.
- Keep repository tokens short-lived and in request scope.
- Never force-push main.
- Require human authorization before merge.

## Realtime safety

- Authenticate WebSocket upgrades.
- Authorize the requested RFD and branch before resolving the Durable Object.
- Limit message size and update frequency.
- Reject malformed Yjs messages.
- Expire awareness state after disconnect.
- Preserve persisted document state across malformed client messages.
- Rate-limit room creation and connection attempts.

## Comments

Comment content is treated as untrusted user input. Rendering escapes HTML and applies the same link policy as RFD content. Comment anchors are validated against the requested RFD and branch.

Deleting an account must define whether authored comments are anonymized or retained with attribution. The default is retention with a deleted-user marker so review history remains understandable.

## Memory privacy

Only committed public main-branch RFDs are indexed by default. Drafts, private notes, comments, provider credentials, and OAuth data are excluded. Every search is scoped to the deployment's configured memory container.

## Audit events

Persist security-relevant events for:

- Ownership and role changes
- Git token issuance
- Checkpoints and merges
- Provider configuration changes
- User credential creation and deletion
- Quota changes
- Failed authorization attempts requiring investigation

Audit records contain identifiers and outcomes, not secret values or full document bodies.
