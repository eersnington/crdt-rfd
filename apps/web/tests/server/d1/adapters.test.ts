import type { D1Database } from "@cloudflare/workers-types";
import { RfdId, UserId, WorkspaceId } from "@crdt-rfd/domain";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { d1MembershipStore } from "../../../src/server/d1/adapters.ts";

const databaseFor = (workspace: unknown, membership: unknown): D1Database =>
  ({
    prepare: (query: string) => ({
      bind: () => ({
        first: async () => (query.includes("workspace_settings") ? workspace : membership),
      }),
    }),
  }) as unknown as D1Database;

const workspace = {
  workspace_id: "w1",
  owner_user_id: "u1",
  reviewer_can_merge: 1,
  created_at: 1,
  updated_at: 2,
};

const membership = {
  workspace_id: "w1",
  rfd_id: "r1",
  user_id: "u1",
  role: "author",
  created_at: 1,
  updated_at: 2,
};

const input = {
  userId: Schema.decodeUnknownSync(UserId)("u1"),
  workspaceId: Schema.decodeUnknownSync(WorkspaceId)("w1"),
  rfdId: Schema.decodeUnknownSync(RfdId)("r1"),
};

describe("D1 membership store", () => {
  it("decodes workspace and membership rows before authorizing", async () => {
    const result = await Effect.runPromise(
      d1MembershipStore(databaseFor(workspace, membership)).load(input),
    );
    expect(result).toEqual({
      workspaceOwner: true,
      rfdRole: "owner",
      policy: { reviewerCanMerge: true },
    });
  });

  it("maps malformed D1 rows to MembershipStoreError", async () => {
    const error = await Effect.runPromise(
      d1MembershipStore(databaseFor(workspace, { ...membership, role: "invalid" }))
        .load(input)
        .pipe(Effect.flip),
    );
    expect(error).toMatchObject({
      _tag: "MembershipStoreError",
      operation: "load",
      message:
        "D1 could not load valid authorization memberships. Check the database query and stored row shape.",
    });
  });
});
