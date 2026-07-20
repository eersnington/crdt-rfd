import type { D1Database } from "@cloudflare/workers-types";
import { RfdMembership, WorkspaceSettings } from "@crdt-rfd/domain";
import { Effect, Layer, Schema } from "effect";
import {
  MembershipStore,
  type MembershipStoreShape,
  MembershipStoreError,
} from "../authorization/memberships.ts";

const Timestamp = Schema.Number.check(Schema.isInt());
const WorkspaceSettingsRow = Schema.Struct({
  workspace_id: Schema.String,
  owner_user_id: Schema.String,
  reviewer_can_merge: Schema.Literals([0, 1]),
  created_at: Timestamp,
  updated_at: Timestamp,
});
const RfdMembershipRow = Schema.Struct({
  workspace_id: Schema.String,
  rfd_id: Schema.String,
  user_id: Schema.String,
  role: Schema.Literals(["author", "coauthor", "reviewer"]),
  created_at: Timestamp,
  updated_at: Timestamp,
});

const parseWorkspaceSettings = Effect.fn("MembershipStore.decodeWorkspaceSettings")(function* (
  row: unknown,
) {
  const decoded = yield* Schema.decodeUnknownEffect(WorkspaceSettingsRow, {
    onExcessProperty: "error",
  })(row);
  return yield* Schema.decodeUnknownEffect(WorkspaceSettings, {
    onExcessProperty: "error",
  })({
    workspaceId: decoded.workspace_id,
    ownerUserId: decoded.owner_user_id,
    reviewerCanMerge: decoded.reviewer_can_merge === 1,
    createdAt: new Date(decoded.created_at),
    updatedAt: new Date(decoded.updated_at),
  });
});

const parseRfdMembership = Effect.fn("MembershipStore.decodeRfdMembership")(function* (
  row: unknown,
) {
  const decoded = yield* Schema.decodeUnknownEffect(RfdMembershipRow, {
    onExcessProperty: "error",
  })(row);
  return yield* Schema.decodeUnknownEffect(RfdMembership, {
    onExcessProperty: "error",
  })({
    workspaceId: decoded.workspace_id,
    rfdId: decoded.rfd_id,
    userId: decoded.user_id,
    role:
      decoded.role === "author" ? "owner" : decoded.role === "coauthor" ? "editor" : "commenter",
    createdAt: new Date(decoded.created_at),
    updatedAt: new Date(decoded.updated_at),
  });
});

export const d1MembershipStore = (database: D1Database): MembershipStoreShape => ({
  load: Effect.fn("MembershipStore.d1.load")(({ userId, workspaceId, rfdId }) =>
    Effect.tryPromise({
      try: async () => {
        const workspaceRow = await database
          .prepare(
            "SELECT workspace_id, owner_user_id, reviewer_can_merge, created_at, updated_at FROM workspace_settings WHERE workspace_id = ?",
          )
          .bind(workspaceId)
          .first();
        const membershipRow =
          rfdId === undefined
            ? null
            : await database
                .prepare(
                  "SELECT workspace_id, rfd_id, user_id, role, created_at, updated_at FROM rfd_memberships WHERE workspace_id = ? AND rfd_id = ? AND user_id = ?",
                )
                .bind(workspaceId, rfdId, userId)
                .first();
        return { workspaceRow, membershipRow };
      },
      catch: (cause) => cause,
    }).pipe(
      Effect.flatMap(({ workspaceRow, membershipRow }) =>
        Effect.all({
          workspace:
            workspaceRow === null
              ? Effect.succeed(undefined)
              : parseWorkspaceSettings(workspaceRow),
          membership:
            membershipRow === null ? Effect.succeed(undefined) : parseRfdMembership(membershipRow),
        }),
      ),
      Effect.map(({ workspace, membership }) => ({
        workspaceOwner: workspace?.ownerUserId === userId,
        ...(membership === undefined ? {} : { rfdRole: membership.role }),
        policy: { reviewerCanMerge: workspace?.reviewerCanMerge === true },
      })),
      Effect.mapError(
        (cause) =>
          new MembershipStoreError({
            operation: "load",
            message:
              "D1 could not load valid authorization memberships. Check the database query and stored row shape.",
            cause,
          }),
      ),
    ),
  ),
});

export const d1MembershipStoreLayer = (database: D1Database) =>
  Layer.succeed(MembershipStore, d1MembershipStore(database));
