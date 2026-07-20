import { RfdId, UserId, WorkspaceId } from "@crdt-rfd/domain";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import {
  inMemoryMembershipStoreLayer,
  MembershipStore,
} from "../../../src/server/authorization/memberships.ts";

describe("membership loading", () => {
  it("loads membership separately from authentication", async () => {
    const entries = new Map([
      [
        "u1:w1:r1",
        {
          workspaceOwner: false,
          rfdRole: "commenter" as const,
          policy: { reviewerCanMerge: true },
        },
      ],
    ]);
    const memberships = await Effect.runPromise(
      Effect.flatMap(MembershipStore, (store) =>
        store.load({
          userId: Schema.decodeUnknownSync(UserId)("u1"),
          workspaceId: Schema.decodeUnknownSync(WorkspaceId)("w1"),
          rfdId: Schema.decodeUnknownSync(RfdId)("r1"),
        }),
      ).pipe(Effect.provide(inMemoryMembershipStoreLayer(entries))),
    );
    expect(memberships).toEqual(entries.get("u1:w1:r1"));
  });
});
