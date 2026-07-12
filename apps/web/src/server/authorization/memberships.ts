import type { RfdRole, WorkspacePolicy } from "@crdt-rfd/domain";
import { Context, Effect, Layer, Ref } from "effect";
import { MembershipStoreError } from "../auth/errors.ts";

export interface AuthorizationMemberships {
  readonly workspaceOwner: boolean;
  readonly rfdRole?: RfdRole;
  readonly policy: WorkspacePolicy;
}

export interface MembershipStoreShape {
  readonly load: (input: {
    readonly userId: string;
    readonly workspaceId: string;
    readonly rfdId?: string;
  }) => Effect.Effect<AuthorizationMemberships, MembershipStoreError>;
}

export class MembershipStore extends Context.Service<MembershipStore, MembershipStoreShape>()(
  "crdt-rfd/MembershipStore",
) {}

export const loadAuthorizationMemberships = (input: {
  readonly userId: string;
  readonly workspaceId: string;
  readonly rfdId?: string;
}) => MembershipStore.use((store) => store.load(input));

export const inMemoryMembershipStoreLayer = (
  entries: ReadonlyMap<string, AuthorizationMemberships>,
) =>
  Layer.effect(
    MembershipStore,
    Effect.gen(function* () {
      const values = yield* Ref.make(entries);
      return {
        load: ({ userId, workspaceId, rfdId }) =>
          Ref.get(values).pipe(
            Effect.map(
              (map) =>
                map.get(`${userId}:${workspaceId}:${rfdId ?? ""}`) ?? {
                  workspaceOwner: false,
                  policy: { reviewerCanMerge: false },
                },
            ),
          ),
      } satisfies MembershipStoreShape;
    }),
  );
