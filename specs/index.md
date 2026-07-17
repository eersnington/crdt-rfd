# CRDT RFD platform

## Summary

This project is a public Request for Discussion space. Anyone can browse RFDs people create. Authors co-write in a Notion-like editor (Tiptap + Yjs). Each RFD is its own Cloudflare Artifacts Git repository. Internals are Git-like (history, fork, tokens); the interface is document-like (presence, comments, checkpoints).

Users own RFDs they create and can invite editors and commenters. Forking an RFD creates a new Artifacts repo and a new owned RFD. Supermemory and AI keys are bring-your-own. Agents reach the same capabilities through a first-party remote MCP server and in-app Code Mode executed on Dynamic Workers.

## Product principles

- Humans collaborate through CRDT documents.
- Each RFD is one Artifacts repository.
- Cloudflare Artifacts preserves committed history; the binding is control plane, Git is data plane.
- Users own RFDs; the deployment owns infrastructure (namespace, Worker, D1).
- Public reading requires no account.
- Supermemory and model keys are user-supplied.
- Agents use MCP and Code Mode against the same authorized services.
- Secrets never reach the browser or the Dynamic Worker sandbox.

## System outline

```text
Browser
  Tiptap + Yjs | public list | comments | settings | chat
                 |
TanStack Start Worker (Effect services)
  Auth · Catalog · Access · RfdRepository · Comments · Memory · Chat · MCP
                 |
   +-------------+-------------+----------------+------------------+
   |             |             |                |                  |
  D1      Document room     Artifacts      User Supermemory    LOADER
          Durable Object    (1 repo/RFD)   hosted | self-host   Dynamic Workers
                                                                    |
                                                              Code Mode runtime
```

## Source-of-truth boundaries

| State | Authority |
| --- | --- |
| Active collaborative draft | Yjs state in the RFD Durable Object |
| Committed RFD content and history | That RFD's Artifacts Git repository |
| Catalog, ownership, comments, user provider config | D1 |
| Semantic memory for a user | That user's Supermemory container |

## Workstreams

| Workstream | Scope | Depends on |
| --- | --- | --- |
| [01 Foundation](./01-foundation/prd.md) | Alchemy, Effect contracts, D1, GitHub OAuth, authorization | None (complete) |
| [02 RFD Artifact](./02-rfd-artifact/prd.md) | Per-RFD Artifacts repos, checkpoint, history, fork, catalog | 01 |
| [03 Editor and CRDT](./03-editor-crdt/prd.md) | Tiptap, Markdown boundary, Yjs, Durable Objects, checkpoint UI | 01, 02 |
| [04 Access and comments](./04-access-comments/prd.md) | Roles, invite, comment policy, threaded comments | 01, 03 |
| [05 Memory and chat](./05-memory-chat/prd.md) | User Supermemory, AI keys, index interacted RFDs, chat | 01, 02, 03, 04 |
| [06 Agents](./06-agents/prd.md) | Remote MCP, Code Mode, Dynamic Workers | 01–05 |

Progress: [01](./01-foundation/progress.md), [02](./02-rfd-artifact/progress.md), [03](./03-editor-crdt/progress.md), [04](./04-access-comments/progress.md), [05](./05-memory-chat/progress.md), [06](./06-agents/progress.md).

## MVP completion

The MVP is complete when:

1. The public home lists RFDs people created.
2. A signed-in user can create an RFD backed by a new Artifacts repository.
3. Owners can invite editors and set comment access to anyone or members only.
4. Two users can co-edit an RFD in realtime and checkpoint to that RFD's Artifact.
5. A user can fork an RFD into a new owned Artifact and RFD.
6. Threaded comments work on the live document.
7. A user can connect Supermemory (hosted or self-hosted) and AI keys, have interacted RFDs indexed, and chat with citations.
8. First-party MCP exposes core tools, and Code Mode runs composed plans on Dynamic Workers without exposing secrets to the sandbox.
