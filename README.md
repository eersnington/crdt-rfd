# Write RFDs together. Keep the Markdown and Git history.

CRDT RFD is a place for technical proposals that need both live collaboration and a durable versioned record. Each RFD is a Markdown file in its own Cloudflare Artifacts repository. Draft it with other people in the browser, then commit a checkpoint when the proposal reaches a meaningful state.

A collaborative notes app like Notion makes it pleasant to write together, but their history is trapped in the tool. A VCS like Git keeps history and works locally, but interfacing with it is a bit clunky and it's not great for collaborative editing. CRDT RFD keeps the live draft in a CRDT editor and stores each checkpoint as a normal Git commit.

## What you can do

- Read public RFDs as rendered Markdown
- Edit an RFD with other people through Tiptap and Yjs
- Checkpoint the current draft to Git with a commit message
- Open any checkpoint as a read-only version
- Fork an RFD into a new RFD and repository that you own
- Clone an RFD to inspect `rfd.md` and its Git history locally

## The model

An RFD has two states:

- **Live draft**: the shared Yjs document that collaborators edit in real time
- **Checkpoint**: validated Markdown committed to the RFD's Git repository

The draft can be ahead of Git. Checkpointing serializes it to `rfd.md` and creates a commit. Git is the record of published versions; the CRDT is the place where the next version is written.

Forking creates a new RFD with its own repository and records where it came from. The source RFD stays unchanged. A fork can then follow its own history.

## Work locally

Use **Actions** on an RFD to generate a short-lived, read-only credential for the version you want. The page gives you a command like this:

```sh
git clone https://x:your_read_token_here@your_artifacts_remote
```

The credential expires after five minutes. After cloning, inspect the document and its history with standard Git commands:

```sh
git log --oneline
git show HEAD:rfd.md
```

## Development

Install dependencies and start the local app:

```sh
bun install
bun run dev
```

`bun run dev` reads `apps/web/.env`. Deployment commands read `apps/web/.env.production`. Both files are ignored by Git. Configure the environment and GitHub OAuth callback in [`apps/web/README.md`](./apps/web/README.md).

Run checks before submitting a change:

```sh
bun run check
bun run test
bun run build
```

The product requirements are in [`specs/product-requirements.md`](./specs/product-requirements.md). The architecture is in [`specs/architecture.md`](./specs/architecture.md).
