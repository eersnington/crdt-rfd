import { Schema } from "effect";
import { RfdId, UserId, WorkspaceId } from "./values.ts";

export const RfdRole = Schema.Literals(["author", "coauthor", "reviewer"]);
export type RfdRole = typeof RfdRole.Type;
export const WorkspaceRole = Schema.Literal("workspace-owner");
export type WorkspaceRole = typeof WorkspaceRole.Type;
export const Role = Schema.Union([WorkspaceRole, RfdRole]);
export type Role = typeof Role.Type;

export const Permission = Schema.Literals([
  "create-rfd",
  "edit",
  "checkpoint",
  "comment",
  "create-proposal",
  "merge-proposal",
  "manage-members",
  "transfer-ownership",
  "configure-workspace",
]);
export type Permission = typeof Permission.Type;

export const WorkspacePolicy = Schema.Struct({
  reviewerCanMerge: Schema.Boolean,
});
export type WorkspacePolicy = typeof WorkspacePolicy.Type;

export const WorkspaceSettings = Schema.Struct({
  workspaceId: WorkspaceId,
  ownerUserId: UserId,
  reviewerCanMerge: Schema.Boolean,
  createdAt: Schema.DateValid,
  updatedAt: Schema.DateValid,
});
export type WorkspaceSettings = typeof WorkspaceSettings.Type;

export const RfdMembership = Schema.Struct({
  workspaceId: WorkspaceId,
  rfdId: RfdId,
  userId: UserId,
  role: RfdRole,
  createdAt: Schema.DateValid,
  updatedAt: Schema.DateValid,
});
export type RfdMembership = typeof RfdMembership.Type;

const permissions: Record<Role, ReadonlySet<Permission>> = {
  "workspace-owner": new Set(Permission.literals),
  author: new Set([
    "edit",
    "checkpoint",
    "comment",
    "create-proposal",
    "merge-proposal",
    "manage-members",
    "transfer-ownership",
  ]),
  coauthor: new Set(["edit", "checkpoint", "comment", "create-proposal"]),
  reviewer: new Set(["comment", "create-proposal"]),
};

export const hasPermission = (
  role: Role,
  permission: Permission,
  policy: WorkspacePolicy,
): boolean =>
  permissions[role].has(permission) ||
  (role === "reviewer" && permission === "merge-proposal" && policy.reviewerCanMerge);
