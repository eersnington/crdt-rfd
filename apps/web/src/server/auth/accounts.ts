import { Context, Effect, Layer, Ref } from "effect";
import { AccountLinkConflictError, SessionStoreError } from "./errors.ts";
import type { OAuthIdentity } from "./identity-provider.ts";

export interface UserAccount {
  readonly id: string;
  readonly displayName: string;
  readonly avatarUrl?: string;
}

export interface AccountStoreShape {
  readonly findByProviderIdentity: (
    providerAccountId: string,
  ) => Effect.Effect<UserAccount | undefined, SessionStoreError>;
  readonly link: (
    user: UserAccount,
    identity: OAuthIdentity,
  ) => Effect.Effect<UserAccount, AccountLinkConflictError | SessionStoreError>;
}

export class AccountStore extends Context.Service<AccountStore, AccountStoreShape>()(
  "crdt-rfd/AccountStore",
) {}

export const connectGitHubIdentity = (identity: OAuthIdentity, authenticatedUser?: UserAccount) =>
  Effect.gen(function* () {
    const store = yield* AccountStore;
    const existing = yield* store.findByProviderIdentity(identity.providerAccountId);
    if (existing !== undefined) {
      if (authenticatedUser !== undefined && existing.id !== authenticatedUser.id) {
        return yield* new AccountLinkConflictError({
          provider: "github",
          providerAccountId: identity.providerAccountId,
          existingUserId: existing.id,
        });
      }
      return existing;
    }
    const user = authenticatedUser ?? {
      id: crypto.randomUUID(),
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
    };
    return yield* store.link(user, identity);
  });

export const inMemoryAccountStoreLayer = Layer.effect(
  AccountStore,
  Effect.gen(function* () {
    const accounts = yield* Ref.make(new Map<string, UserAccount>());
    return {
      findByProviderIdentity: (providerAccountId) =>
        Ref.get(accounts).pipe(Effect.map((map) => map.get(providerAccountId))),
      link: (user, identity) =>
        Effect.gen(function* () {
          const map = yield* Ref.get(accounts);
          const existing = map.get(identity.providerAccountId);
          if (existing !== undefined && existing.id !== user.id) {
            return yield* new AccountLinkConflictError({
              provider: "github",
              providerAccountId: identity.providerAccountId,
              existingUserId: existing.id,
            });
          }
          yield* Ref.set(accounts, new Map(map).set(identity.providerAccountId, user));
          return user;
        }),
    } satisfies AccountStoreShape;
  }),
);
