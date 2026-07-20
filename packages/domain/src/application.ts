import { Schema } from "effect";
import { RfdStatus } from "./contracts.ts";
import { BranchName, CommitSha, RfdId, RfdNumber, UserId } from "./values.ts";

const IsoTimestamp = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/),
  Schema.makeFilter((value) => !Number.isNaN(Date.parse(value)), {
    expected: "a valid ISO 8601 timestamp with an explicit timezone",
  }),
);

export const RfdSummary = Schema.Struct({
  rfdId: RfdId,
  number: RfdNumber,
  title: Schema.String,
  status: RfdStatus,
  author: Schema.String,
  updated: IsoTimestamp,
  labels: Schema.Array(Schema.String),
});
export type RfdSummary = typeof RfdSummary.Type;

export const RfdSummaries = Schema.Array(RfdSummary);

export const CreateRfdInput = Schema.Struct({
  title: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
});
export type CreateRfdInput = typeof CreateRfdInput.Type;

export const CommittedRfdDocument = Schema.Struct({
  rfdId: RfdId,
  number: RfdNumber,
  title: Schema.String,
  status: RfdStatus,
  author: Schema.String,
  updated: IsoTimestamp,
  body: Schema.String,
  headSha: CommitSha,
  checkpointMessage: Schema.String,
});
export type CommittedRfdDocument = typeof CommittedRfdDocument.Type;

export const GetRfdInput = Schema.Struct({ rfdId: RfdId });
export type GetRfdInput = typeof GetRfdInput.Type;

export const RfdRef = Schema.Union([
  Schema.Struct({ _tag: Schema.tag("Branch"), branch: BranchName }),
  Schema.Struct({ _tag: Schema.tag("Checkpoint"), sha: CommitSha }),
]);
export type RfdRef = typeof RfdRef.Type;

export const GetRfdRefInput = Schema.Struct({ rfdId: RfdId, ref: RfdRef });
export type GetRfdRefInput = typeof GetRfdRefInput.Type;

export const ForkRfdInput = Schema.Struct({ sourceRfdId: RfdId, source: RfdRef });
export type ForkRfdInput = typeof ForkRfdInput.Type;

export const ForkRfdResult = Schema.Struct({
  rfdId: RfdId,
  sourceRfdId: RfdId,
  sourceSha: CommitSha,
});
export type ForkRfdResult = typeof ForkRfdResult.Type;

export const MintCloneCredentialInput = Schema.Struct({ rfdId: RfdId, ref: RfdRef });
export type MintCloneCredentialInput = typeof MintCloneCredentialInput.Type;

export const CloneCredential = Schema.Struct({
  remote: Schema.String,
  username: Schema.String,
  token: Schema.String,
  expiresAt: IsoTimestamp,
  ref: RfdRef,
});
export type CloneCredential = typeof CloneCredential.Type;

export const RfdCheckpoint = Schema.Struct({
  sha: CommitSha,
  message: Schema.String,
  author: Schema.String,
  createdAt: IsoTimestamp,
});
export type RfdCheckpoint = typeof RfdCheckpoint.Type;
export const RfdCheckpoints = Schema.Array(RfdCheckpoint);

export const CurrentUser = Schema.Struct({
  id: UserId,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
});
export type CurrentUser = typeof CurrentUser.Type;

export const CurrentSession = Schema.Struct({
  user: CurrentUser,
  expiresAt: Schema.DateValid,
});
export type CurrentSession = typeof CurrentSession.Type;

export const OptionalCurrentSession = Schema.NullOr(CurrentSession);

export class CatalogUnavailable extends Schema.TaggedErrorClass<CatalogUnavailable>()(
  "CatalogUnavailable",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

export class SessionUnavailable extends Schema.TaggedErrorClass<SessionUnavailable>()(
  "SessionUnavailable",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

export class RfdOperationFailed extends Schema.TaggedErrorClass<RfdOperationFailed>()(
  "RfdOperationFailed",
  {
    operation: Schema.String,
    message: Schema.String,
  },
) {}

export class AuthenticationRequired extends Schema.TaggedErrorClass<AuthenticationRequired>()(
  "AuthenticationRequired",
  { message: Schema.String },
) {}
