# Product requirements

## Problem

Technical proposals are often split across document editors, chat threads, and Git repositories. Realtime editors make collaboration easy but hide durable revision history. Git preserves history but is awkward for synchronous writing and review. Prior decisions are difficult to retrieve when a new proposal revisits an old constraint.

The platform combines realtime collaborative editing, Git-native proposal branches, and semantic recall while keeping the public reading experience simple.

## Users

### Public reader

- Browse and search public RFDs without signing in.
- Read rendered Markdown, metadata, related RFDs, and commit history.
- View accepted and open proposals when permitted by workspace policy.

### Author

- Create and own an RFD.
- Invite coauthors and reviewers.
- Edit the RFD with other authors in realtime.
- Checkpoint the current draft.
- Request an alternative proposal from an AI model.
- Review, revise, merge, or abandon proposal branches.

### Coauthor

- Edit and checkpoint an RFD according to the permissions granted by its author.
- Create and review proposals.

### Reviewer

- Comment on the current document or a proposal diff.
- Request revisions.
- Create a proposal when workspace policy permits it.
- Merge only when explicitly granted that permission.

### Deployment owner

- Configure workspace policy, authentication, memory, and AI funding.
- Manage users and recover ownership.
- Operate the deployment and its single Artifacts repository.

## Core workflow

1. An author opens an RFD.
2. The browser connects to the Durable Object for the selected RFD branch.
3. Authors edit a shared Yjs document through Tiptap.
4. The system shows presence, cursors, dirty state, and the current Git base commit.
5. A checkpoint serializes the editor document to Markdown and commits it to Artifacts.
6. The committed main branch is indexed in Supermemory.
7. An author requests an alternative proposal.
8. The system checkpoints main, creates a proposal branch, retrieves related memories, and invokes the configured AI provider.
9. The generated Markdown is validated and committed to the proposal branch.
10. Reviewers inspect a diff, comment, request revisions, and merge or abandon the proposal.

## Functional requirements

### Public RFD site

- Show RFD number, title, status, authors, and updated date.
- Render readable Markdown with an outline and stable section links.
- Show related and superseded RFDs.
- Show the active branch and commit history.
- Support semantic search over committed public RFDs.

### Editing

- Provide a block-oriented WYSIWYG editor using Tiptap.
- Use Yjs as the shared CRDT document.
- Synchronize through WebSockets connected to a Durable Object.
- Show collaborators, cursors, connection state, dirty state, and checkpoint state.
- Preserve the supported Markdown subset through import and export.
- Edit frontmatter through validated metadata controls rather than raw YAML.

### Checkpoints

- Checkpoint on explicit save, configured idle timeout, proposal creation, review request, and merge.
- Do not create a Git commit for every CRDT update.
- Validate frontmatter and Markdown before committing.
- Commit against an expected parent SHA.
- Return a conflict when the branch head changed instead of forcing a push.

### Comments

- Support threaded comments on live document ranges.
- Anchor live comments with Yjs relative positions.
- Support comments on proposal diff lines.
- Preserve authorship, timestamps, replies, and resolution state in D1.
- Mark anchors outdated when they can no longer resolve safely.

### Git and proposals

- Store committed Markdown in a Cloudflare Artifacts repository.
- Allow authorized users to mint short-lived clone credentials.
- Create proposal branches without changing the source branch.
- Show inline and side-by-side diffs.
- Allow manual proposal edits and further AI revisions.
- Merge clean proposals and report structured merge conflicts.
- Allow proposals to be abandoned without deleting main-branch history.

### Supermemory

- Index only committed main-branch content.
- Extract decisions, assumptions, constraints, rejected alternatives, open questions, and relationships.
- Attach workspace ID, RFD ID, file path, branch, commit SHA, section, and memory type to every record.
- Support hosted and self-hosted endpoints through deploy-time configuration.
- Rebuild the memory index from Artifacts without losing canonical data.

### AI proposals

- Support deployer-funded Workers AI through the native binding.
- Support user-funded Workers AI through server-side REST calls with user credentials.
- Allow deployment policy to select deployer-only, user-only, or deployer-or-user funding.
- Restrict generated changes to the selected RFD path.
- Preserve validated frontmatter.
- Require a human-authorized merge.
- Return a short proposal summary and a committed branch SHA.

### External Git changes

- Consume Cloudflare Artifacts push events.
- Reload a clean Durable Object when its branch changes externally.
- Put a dirty Durable Object into conflict state instead of overwriting it.
- Reindex new main-branch commits.
- Deduplicate event delivery.

## Non-functional requirements

- The public reader must work on mobile and desktop.
- Expected failure paths use tagged Effect errors rather than unchecked exceptions.
- API inputs and persisted records are schema-validated.
- Secrets never reach browser JavaScript or application logs.
- Realtime sessions recover after Durable Object eviction and Worker deployment.
- The application remains usable when Supermemory or AI generation is disabled.
- A fork can deploy one independent workspace without adopting a multi-tenant control plane.

## Supported Markdown policy

The initial supported subset includes:

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

- MDX and executable document components
- React Server Components
- User-supplied Workers
- Full GitHub pull request compatibility
- Per-user GitHub repository provisioning
- General-purpose wiki databases
- Enterprise-grade fine-grained permissions
- Offline-first editing
- Automatic conflict resolution that can overwrite user work

## Acceptance criteria

1. Two users can edit the same RFD and converge on the same content.
2. The Artifacts repository can be cloned and pushed through standard Git tooling.
3. The current CRDT state can be checkpointed as validated Markdown.
4. An authorized user can request an alternative proposal.
5. The proposal is committed to a separate Artifacts branch.
6. The UI displays a readable diff and comments.
7. An authorized user can merge the proposal.
8. Supermemory returns prior decisions during proposal generation.
9. Every memory result can be traced to a file path and commit SHA.
10. An external push cannot silently overwrite an uncommitted collaborative draft.
