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

export const nextRfdStatuses = (from: RfdStatus): ReadonlyArray<RfdStatus> =>
  RfdStatus.literals.filter((to) => transitions[from].has(to));

export const ProposalSource = Schema.TaggedUnion({
  Human: { userId: UserId },
  Agent: { model: Schema.String },
});

const ProposalFields = {
  sourceBranch: BranchName,
  sourceCommit: CommitSha,
  targetBranch: BranchName,
  headCommit: CommitSha,
  source: ProposalSource,
  summary: Schema.String,
};

export const Proposal = Schema.Union([
  Schema.Struct({
    ...ProposalFields,
    status: Schema.Literals(["generating", "open", "revising", "merged", "abandoned"]),
  }),
  Schema.Struct({
    ...ProposalFields,
    status: Schema.Literal("failed"),
    diagnostic: Schema.String.check(Schema.isMinLength(1)),
  }),
]).check(
  Schema.makeFilter((proposal) => proposal.sourceBranch !== proposal.targetBranch, {
    expected: "sourceBranch and targetBranch to differ",
  }),
);

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

export const CommentAnchor = Schema.TaggedUnion({
  DocumentRange: {
    branch: BranchName,
    start: Schema.Uint8Array,
    end: Schema.Uint8Array,
  },
  DiffLine: {
    baseSha: CommitSha,
    headSha: CommitSha,
    side: Schema.Literals(["base", "head"]),
    line: Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)),
  },
});
