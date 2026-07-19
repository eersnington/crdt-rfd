import { Schema } from "effect";

import { RfdFrontmatter } from "./frontmatter.ts";
import { CommitSha, RfdId, UserId } from "./values.ts";

export const EditorMetadata = RfdFrontmatter;
export type EditorMetadata = typeof EditorMetadata.Type;

export const RoomRole = Schema.Literals(["owner", "editor", "commenter"]);
export type RoomRole = typeof RoomRole.Type;

export const RoomCapability = Schema.Struct({
  role: RoomRole,
  canEdit: Schema.Boolean,
  canCheckpoint: Schema.Boolean,
  canManageMembers: Schema.Boolean,
});
export type RoomCapability = typeof RoomCapability.Type;

export const CleanRoom = Schema.Struct({
  _tag: Schema.tag("Clean"),
  baseSha: CommitSha,
});
export const DirtyRoom = Schema.Struct({
  _tag: Schema.tag("Dirty"),
  baseSha: CommitSha,
});
export const CheckpointingRoom = Schema.Struct({
  _tag: Schema.tag("Checkpointing"),
  baseSha: CommitSha,
});
export const ConflictedRoom = Schema.Struct({
  _tag: Schema.tag("Conflicted"),
  baseSha: CommitSha,
  remoteSha: CommitSha,
});
export const RoomStatus = Schema.Union([CleanRoom, DirtyRoom, CheckpointingRoom, ConflictedRoom]);
export type RoomStatus = typeof RoomStatus.Type;

export const RoomBootstrap = Schema.Struct({
  rfdId: RfdId,
  capability: RoomCapability,
  status: RoomStatus,
  protocolVersion: Schema.Literal(1),
  documentFormatVersion: Schema.Literal(1),
});
export type RoomBootstrap = typeof RoomBootstrap.Type;

export const CheckpointRfdInput = Schema.Struct({
  rfdId: RfdId,
  expectedHeadSha: CommitSha,
  source: Schema.String,
});
export type CheckpointRfdInput = typeof CheckpointRfdInput.Type;

export const CheckpointResult = Schema.Struct({
  rfdId: RfdId,
  previousHeadSha: CommitSha,
  headSha: CommitSha,
});
export type CheckpointResult = typeof CheckpointResult.Type;

export const RoomIdentity = Schema.Struct({
  userId: UserId,
  name: Schema.String,
  role: RoomRole,
});
export type RoomIdentity = typeof RoomIdentity.Type;

export class RoomUnavailable extends Schema.TaggedErrorClass<RoomUnavailable>()("RoomUnavailable", {
  message: Schema.String,
}) {}

export class EditorAuthorizationError extends Schema.TaggedErrorClass<EditorAuthorizationError>()(
  "EditorAuthorizationError",
  { message: Schema.String },
) {}

export class CheckpointConflict extends Schema.TaggedErrorClass<CheckpointConflict>()(
  "CheckpointConflict",
  { expectedHeadSha: CommitSha, actualHeadSha: CommitSha, message: Schema.String },
) {}

export class CheckpointFailed extends Schema.TaggedErrorClass<CheckpointFailed>()(
  "CheckpointFailed",
  { message: Schema.String },
) {}

export class MarkdownCompatibilityError extends Schema.TaggedErrorClass<MarkdownCompatibilityError>()(
  "MarkdownCompatibilityError",
  { message: Schema.String, unsupported: Schema.Array(Schema.String) },
) {}
