import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  inMemoryMembershipStoreLayer,
  loadAuthorizationMemberships,
} from "../../../src/server/authorization/memberships.ts";

describe("membership loading", () => {
  it("loads membership separately from authentication", async () => {
    const entries = new Map([
      [
        "u1:w1:r1",
        { workspaceOwner: false, rfdRole: "reviewer" as const, policy: { reviewerCanMerge: true } },
      ],
    ]);
    const memberships = await Effect.runPromise(
      loadAuthorizationMemberships({ userId: "u1", workspaceId: "w1", rfdId: "r1" }).pipe(
        Effect.provide(inMemoryMembershipStoreLayer(entries)),
      ),
    );
    expect(memberships).toEqual(entries.get("u1:w1:r1"));
  });
});
