# Product requirements

## Problem

Technical proposals are scattered across docs tools, chat, and Git. Realtime editors hide durable history. Git preserves history but is awkward for synchronous writing. Prior decisions are hard to reuse when drafting the next proposal.

This product combines a Notion-like collaborative editor, one Git Artifact per RFD, public browsing, user-owned forks, bring-your-own memory and AI, and first-party agent access (MCP + Code Mode).

## Users

### Public reader

- Browse and search the public RFD list without signing in.
- Open an RFD and read committed Markdown, metadata, history, and related/fork lineage when present.
- Comment only when the RFD allows anyone to comment.

### Owner

- Create an RFD (provisions a dedicated Artifacts repository).
- Invite editors and commenters.
- Set comment policy (`anyone` or `members-only`).
- Edit in realtime, checkpoint, view history.
- Fork another RFD into a new owned RFD.
- Configure personal Supermemory and AI keys.
- Use in-app chat over memories from RFDs they interacted with.
- Connect external agents via MCP (OAuth as themselves).

### Editor

- Edit and checkpoint according to owner grants.
- Comment and create forks when allowed by product rules.

### Commenter

- Comment on the live document when invited or when policy is `anyone`.
- Cannot edit or checkpoint unless also granted editor.

## Core workflow

1. A visitor opens `/` and sees RFDs people made.
2. A signed-in user creates an RFD; the system creates an Artifacts repo and seeds `rfd.md`.
3. The browser opens a Durable Object room for that RFD and syncs Yjs through Tiptap.
4. Collaborators edit with presence and cursors; dirty state and last checkpoint are visible.
5. Checkpoint serializes the editor document to Markdown and commits it to that RFD's Artifact.
6. Interacted RFDs are indexed into the user's Supermemory container when configured.
7. Anyone with access can fork: Artifacts `fork` + new catalog row owned by the forker.
8. Comments attach to live ranges with threads and resolution.
9. The owner chats with their model using memory search over interacted RFDs.
10. Agents call the same capabilities through remote MCP or compose them with Code Mode.

## Functional requirements

### Public list and reader

- Home page lists RFDs with number/title/status/authors/updated date.
- Open an RFD for readable Markdown, outline, and stable section links when available.
- Show fork lineage and commit history from the RFD's Artifact.
- Public by default: no account required to list or read committed content.

### Ownership and access

- Creating an RFD makes the creator `owner`.
- Roles: `owner`, `editor`, `commenter`.
- Comment policy: `anyone` | `members-only`.
- Owners manage memberships and transfer ownership without dropping the last owner.
- Authorization is checked on every mutation.

### Editing

- Block-oriented WYSIWYG editor (Tiptap).
- Yjs as the shared CRDT document.
- WebSocket sync to one Durable Object per RFD.
- Show collaborators, cursors, connection state, dirty state, and checkpoint state.
- Preserve the supported Markdown subset through import and export.
- Edit frontmatter through validated controls, not raw YAML.

### Artifacts and checkpoints

- One Artifacts Git repository per RFD (`rfd-{rfdId}` naming).
- Control plane: Workers Artifacts binding (`create`, `get`, `fork`, tokens, log).
- Data plane: transient isomorphic-git + in-memory filesystem for commit/push.
- Checkpoint on explicit save and other product triggers (idle optional later).
- Validate frontmatter and Markdown before commit.
- Prefer expected-parent safety where the Git flow allows; never force-push blindly.
- Short-lived clone tokens for standard Git clients; write tokens never in browser JS.

### Fork

- Fork creates a new Artifacts repository from the source (binding `fork`).
- Catalog records the new RFD with `forkedFrom` (source RFD id and source commit when known).
- Forker becomes owner of the new RFD.

### Comments

- Threaded comments on live document ranges.
- Anchor with Yjs relative positions.
- Authorship, timestamps, replies, resolution in D1.
- Mark anchors outdated when they cannot resolve safely.
- Enforce comment policy and membership.

### Supermemory and chat

- User chooses Off, Hosted, or Self-hosted (base URL + API key).
- Index RFDs the user interacted with (open, edit, comment, fork, own) after meaningful commits when possible.
- Use container tag `user_{userId}` (or equivalent deterministic tag).
- Chat uses user AI credentials and Supermemory profile/search with citations back to RFDs.
- Platform remains usable when memory or AI is off.

### Agents

- Remote MCP server with OAuth as the signed-in user.
- Goal-oriented tools: list/get RFD, search memory, create, fork, comment, checkpoint (authz-gated).
- In-app Code Mode: model writes code that composes connectors; executed by `DynamicWorkerExecutor` via Worker Loader.
- Sandbox has no raw Artifacts tokens, no user API keys, no open internet by default.
- Mutations that need human approval use Code Mode `requiresApproval` where appropriate.
- Optional: expose Code Mode as a single MCP `code` tool via `codeMcpServer`.

## Non-functional requirements

- Public reader works on mobile and desktop.
- Expected failures use tagged Effect errors.
- API inputs and persisted records are schema-validated.
- Secrets never reach browser JavaScript, application logs, or Dynamic Worker env.
- Realtime sessions recover after Durable Object eviction and Worker deployment.
- Artifacts is closed beta; document access requirement and limits (storage, rate).

## Supported Markdown policy

Initial subset:

- YAML frontmatter managed separately from editor content
- Paragraphs and headings
- Emphasis, strong text, inline code, and links
- Ordered and unordered lists
- Blockquotes
- Fenced code blocks
- Horizontal rules
- Tables only after round-trip tests prove stable behavior

Unsupported syntax must produce a visible validation result. It must not be silently discarded.

## Out of scope for MVP

- Release polish / dedicated CI-CD workstream
- Private or unlisted RFDs (public-by-default only)
- Per-user GitHub.com repository provisioning
- Deployer-funded Workers AI as the primary AI path
- MDX and executable document components
- Offline-first editing
- Enterprise multi-tenant control plane beyond a single deployment
- Automatic conflict resolution that overwrites user work

## Acceptance criteria

1. Public home lists RFDs created by users.
2. Create RFD provisions a new Artifacts repo and seeds committed Markdown.
3. Invite editors; comment policy anyone or members-only works.
4. Two users co-edit the same RFD and converge.
5. Checkpoint commits to that RFD's Artifact; history is visible.
6. Fork yields a new owned RFD and Artifact.
7. Threaded comments with stable-enough anchors on concurrent edits.
8. User Supermemory + AI keys enable index of interacted RFDs and cited chat.
9. Remote MCP tools work under user OAuth; Code Mode runs on Dynamic Workers without secret leakage.
10. Browser never receives Artifacts write tokens or provider secrets.
