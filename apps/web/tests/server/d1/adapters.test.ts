import type { D1Database } from "@cloudflare/workers-types";
import { Effect } from "effect";
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

describe("D1 membership store", () => {
  it("decodes workspace and membership rows before authorizing", async () => {
    const result = await Effect.runPromise(
      d1MembershipStore(databaseFor(workspace, membership)).load({
        userId: "u1",
        workspaceId: "w1",
        rfdId: "r1",
      }),
    );
    expect(result).toEqual({
      workspaceOwner: true,
      rfdRole: "author",
      policy: { reviewerCanMerge: true },
    });
  });

  it("maps malformed D1 rows to MembershipStoreError", async () => {
    const error = await Effect.runPromise(
      d1MembershipStore(databaseFor(workspace, { ...membership, role: "owner" }))
        .load({
          userId: "u1",
          workspaceId: "w1",
          rfdId: "r1",
        })
        .pipe(Effect.flip),
    );
    expect(error).toMatchObject({
      _tag: "MembershipStoreError",
      operation: "load",
      message: expect.stringContaining("Invalid rfd_memberships row"),
    });
  });
});
