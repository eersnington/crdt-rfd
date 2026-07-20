import { Schema } from "effect";

const id = <const Name extends string>(name: Name) =>
  Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/)).pipe(
    Schema.brand(name),
  );

export const WorkspaceId = id("WorkspaceId");
export type WorkspaceId = typeof WorkspaceId.Type;
export const UserId = id("UserId");
export type UserId = typeof UserId.Type;
export const RfdId = id("RfdId");
export type RfdId = typeof RfdId.Type;
export const ProposalId = id("ProposalId");
export type ProposalId = typeof ProposalId.Type;
export const CommentThreadId = id("CommentThreadId");
export type CommentThreadId = typeof CommentThreadId.Type;
export const MemoryId = id("MemoryId");
export type MemoryId = typeof MemoryId.Type;

export const RfdNumber = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).pipe(
  Schema.brand("RfdNumber"),
);
export type RfdNumber = typeof RfdNumber.Type;

export const CommitSha = Schema.String.check(Schema.isPattern(/^[0-9a-f]{40}$/)).pipe(
  Schema.brand("CommitSha"),
);
export type CommitSha = typeof CommitSha.Type;

export const BranchName = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(255),
  Schema.isPattern(
    /^(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\.\.)(?!.*@\{)(?!.*\.$)(?!.*\.lock(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
  ),
).pipe(Schema.brand("BranchName"));
export type BranchName = typeof BranchName.Type;

export const GitRef = Schema.String.check(
  Schema.isMaxLength(266),
  Schema.isPattern(
    /^refs\/(?:heads|tags)\/(?!.*(?:^|\/)\.\.?(?:\/|$))(?!.*\.\.)(?!.*@\{)(?!.*\.$)(?!.*\.lock(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/,
  ),
).pipe(Schema.brand("GitRef"));
export type GitRef = typeof GitRef.Type;

export const RfdPath = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(1024),
  Schema.isPattern(/^(?!.*(?:^|\/)\.\.?(?:\/|$))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\.md$/),
).pipe(Schema.brand("RfdPath"));
export type RfdPath = typeof RfdPath.Type;
