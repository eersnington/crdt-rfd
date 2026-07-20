import type { D1Database } from "@cloudflare/workers-types";
import { RfdMembership, WorkspaceSettings } from "@crdt-rfd/domain";
import { Effect, Layer, Result, Schema, SchemaParser } from "effect";
import {
  MembershipStore,
  type AuthorizationMemberships,
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

const decodeWorkspaceSettingsRow = SchemaParser.decodeUnknownResult(WorkspaceSettingsRow, {
  onExcessProperty: "error",
});
const decodeRfdMembershipRow = SchemaParser.decodeUnknownResult(RfdMembershipRow, {
  onExcessProperty: "error",
});
const decodeWorkspaceSettings = SchemaParser.decodeUnknownResult(WorkspaceSettings, {
  onExcessProperty: "error",
});
const decodeRfdMembership = SchemaParser.decodeUnknownResult(RfdMembership, {
  onExcessProperty: "error",
});

const decode = <A>(
  decoded: Result.Result<A, unknown>,
  table: "workspace_settings" | "rfd_memberships",
): A => {
  if (Result.isFailure(decoded))
    throw new Error(`Invalid ${table} row: ${String(decoded.failure)}`);
  return decoded.success;
};

const parseWorkspaceSettings = (row: unknown) => {
  const decoded = decode(decodeWorkspaceSettingsRow(row), "workspace_settings");
  return decode(
    decodeWorkspaceSettings({
      workspaceId: decoded.workspace_id,
      ownerUserId: decoded.owner_user_id,
      reviewerCanMerge: decoded.reviewer_can_merge === 1,
      createdAt: new Date(decoded.created_at),
      updatedAt: new Date(decoded.updated_at),
    }),
    "workspace_settings",
  );
};

const parseRfdMembership = (row: unknown) => {
  const decoded = decode(decodeRfdMembershipRow(row), "rfd_memberships");
  return decode(
    decodeRfdMembership({
      workspaceId: decoded.workspace_id,
      rfdId: decoded.rfd_id,
      userId: decoded.user_id,
      role: decoded.role,
      createdAt: new Date(decoded.created_at),
      updatedAt: new Date(decoded.updated_at),
    }),
    "rfd_memberships",
  );
};

export const d1MembershipStore = (database: D1Database): MembershipStoreShape => ({
  load: ({ userId, workspaceId, rfdId }) =>
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
        const workspace = workspaceRow === null ? undefined : parseWorkspaceSettings(workspaceRow);
        const membership = membershipRow === null ? undefined : parseRfdMembership(membershipRow);
        return {
          workspaceOwner: workspace?.ownerUserId === userId,
          rfdRole: membership?.role,
          policy: { reviewerCanMerge: workspace?.reviewerCanMerge === true },
        } satisfies AuthorizationMemberships;
      },
      catch: (cause) =>
        new MembershipStoreError({
          operation: "load",
          message: `D1 membership load failed: ${String(cause)}`,
        }),
    }),
});

export const d1MembershipStoreLayer = (database: D1Database) =>
  Layer.succeed(MembershipStore, d1MembershipStore(database));
