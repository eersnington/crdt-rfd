import { Schema } from "effect";
import { BranchName, CommitSha, RfdId, RfdPath, UserId, WorkspaceId } from "./values.ts";

export const RfdStatus = Schema.Literals([
  "draft",
  "discussion",
  "accepted",
  "rejected",
  "superseded",
]);
export type RfdStatus = typeof RfdStatus.Type;

const transitions: Readonly<Record<RfdStatus, ReadonlySet<RfdStatus>>> = {
  draft: new Set(["discussion"]),
  discussion: new Set(["accepted", "rejected"]),
  accepted: new Set(["superseded"]),
  rejected: new Set(),
  superseded: new Set(),
};
export const canTransitionRfdStatus = (from: RfdStatus, to: RfdStatus): boolean =>
  transitions[from].has(to);

export const ProposalStatus = Schema.Literals([
  "generating",
  "open",
  "revising",
  "merged",
  "abandoned",
  "failed",
]);
export const ProposalSource = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Human"), userId: UserId }),
  Schema.Struct({ _tag: Schema.Literal("Agent"), model: Schema.String }),
]);
export const Proposal = Schema.Struct({
  sourceBranch: BranchName,
  sourceCommit: CommitSha,
  targetBranch: BranchName,
  headCommit: CommitSha,
  source: ProposalSource,
  summary: Schema.String,
  status: ProposalStatus,
});

export const MemoryType = Schema.Literals([
  "decision",
  "assumption",
  "constraint",
  "rejected-alternative",
  "open-question",
  "relationship",
  "superseded-decision",
]);
export const MemorySource = Schema.Struct({
  workspaceId: WorkspaceId,
  rfdId: RfdId,
  filePath: RfdPath,
  branch: Schema.Literal("main"),
  commitSha: CommitSha,
  section: Schema.optionalKey(Schema.String),
  type: MemoryType,
});

export const CommentAnchor = Schema.Union([
  Schema.Struct({
    _tag: Schema.Literal("DocumentRange"),
    branch: BranchName,
    start: Schema.Uint8Array,
    end: Schema.Uint8Array,
  }),
  Schema.Struct({
    _tag: Schema.Literal("DiffLine"),
    baseSha: CommitSha,
    headSha: CommitSha,
    side: Schema.Literals(["base", "head"]),
    line: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  }),
]);
