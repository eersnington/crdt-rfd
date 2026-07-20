import type { RfdId, RfdRole, UserId, WorkspaceId, WorkspacePolicy } from "@crdt-rfd/domain";
import { Context, Effect, Layer, Schema } from "effect";

export class MembershipStoreError extends Schema.TaggedErrorClass<MembershipStoreError>()(
  "MembershipStoreError",
  {
    operation: Schema.Literal("load"),
    message: Schema.String,
    cause: Schema.Defect(),
  },
) {}

export interface AuthorizationMemberships {
  readonly workspaceOwner: boolean;
  readonly rfdRole?: RfdRole;
  readonly policy: WorkspacePolicy;
}

export interface MembershipStoreShape {
  readonly load: (input: {
    readonly userId: UserId;
    readonly workspaceId: WorkspaceId;
    readonly rfdId?: RfdId;
  }) => Effect.Effect<AuthorizationMemberships, MembershipStoreError>;
}

export class MembershipStore extends Context.Service<MembershipStore, MembershipStoreShape>()(
  "crdt-rfd/MembershipStore",
) {}

export const inMemoryMembershipStoreLayer = (
  entries: ReadonlyMap<string, AuthorizationMemberships>,
) =>
  Layer.succeed(
    MembershipStore,
    MembershipStore.of({
      load: Effect.fn("MembershipStore.inMemory.load")(({ userId, workspaceId, rfdId }) =>
        Effect.succeed(
          entries.get(`${userId}:${workspaceId}:${rfdId ?? ""}`) ?? {
            workspaceOwner: false,
            policy: { reviewerCanMerge: false },
          },
        ),
      ),
    }),
  );
