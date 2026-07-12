import type { D1Database } from "@cloudflare/workers-types";
import { Effect, Layer } from "effect";
import { AccountStore, type AccountStoreShape, type UserAccount } from "../auth/accounts.ts";
import {
  AccountLinkConflictError,
  MembershipStoreError,
  SessionStoreError,
} from "../auth/errors.ts";
import type { OAuthIdentity } from "../auth/identity-provider.ts";
import { SessionStore, type Session, type SessionStoreShape } from "../auth/session.ts";
import {
  MembershipStore,
  type AuthorizationMemberships,
  type MembershipStoreShape,
} from "../authorization/memberships.ts";

const sessionFailure = (operation: SessionStoreError["operation"]) => (cause: unknown) =>
  new SessionStoreError({ operation, message: `D1 session ${operation} failed: ${String(cause)}` });

export const d1SessionStore = (database: D1Database): SessionStoreShape => ({
  create: (session) =>
    Effect.tryPromise({
      try: () =>
        database
          .prepare(
            "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, rotated_at) VALUES (?, ?, ?, ?, ?, ?)",
          )
          .bind(
            session.id,
            session.userId,
            session.tokenHash,
            session.expiresAt,
            session.createdAt,
            session.rotatedAt ?? null,
          )
          .run()
          .then(() => undefined),
      catch: sessionFailure("create"),
    }),
  findByTokenHash: (hash) =>
    Effect.tryPromise({
      try: async () => {
        const row = await database
          .prepare(
            "SELECT id, user_id, token_hash, expires_at, created_at, rotated_at FROM sessions WHERE token_hash = ?",
          )
          .bind(hash)
          .first<{
            id: string;
            user_id: string;
            token_hash: string;
            expires_at: number;
            created_at: number;
            rotated_at: number | null;
          }>();
        return row === null
          ? undefined
          : ({
              id: row.id,
              userId: row.user_id,
              tokenHash: row.token_hash,
              expiresAt: row.expires_at,
              createdAt: row.created_at,
              rotatedAt: row.rotated_at ?? undefined,
            } satisfies Session);
      },
      catch: sessionFailure("read"),
    }),
  deleteByTokenHash: (hash) =>
    Effect.tryPromise({
      try: () =>
        database
          .prepare("DELETE FROM sessions WHERE token_hash = ?")
          .bind(hash)
          .run()
          .then(() => undefined),
      catch: sessionFailure("delete"),
    }),
  rotate: (oldHash, session) =>
    Effect.tryPromise({
      try: async () => {
        const current = await database
          .prepare("SELECT id FROM sessions WHERE token_hash = ?")
          .bind(oldHash)
          .first();
        if (current === null) return false;
        await database.batch([
          database.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(oldHash),
          database
            .prepare(
              "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, rotated_at) VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(
              session.id,
              session.userId,
              session.tokenHash,
              session.expiresAt,
              session.createdAt,
              session.rotatedAt ?? null,
            ),
        ]);
        return true;
      },
      catch: sessionFailure("create"),
    }),
});

export const d1SessionStoreLayer = (database: D1Database) =>
  Layer.succeed(SessionStore, d1SessionStore(database));

export const d1AccountStore = (database: D1Database): AccountStoreShape => ({
  findByProviderIdentity: (providerAccountId) =>
    Effect.tryPromise({
      try: async () => {
        const row = await database
          .prepare(
            "SELECT users.id, users.display_name, users.avatar_url FROM users JOIN oauth_accounts ON oauth_accounts.user_id = users.id WHERE oauth_accounts.provider = 'github' AND oauth_accounts.provider_account_id = ?",
          )
          .bind(providerAccountId)
          .first<{ id: string; display_name: string; avatar_url: string | null }>();
        return row === null
          ? undefined
          : ({
              id: row.id,
              displayName: row.display_name,
              avatarUrl: row.avatar_url ?? undefined,
            } satisfies UserAccount);
      },
      catch: sessionFailure("read"),
    }),
  link: (user, identity: OAuthIdentity) =>
    Effect.tryPromise({
      try: async () => {
        const now = Date.now();
        const existing = await database
          .prepare(
            "SELECT user_id FROM oauth_accounts WHERE provider = 'github' AND provider_account_id = ?",
          )
          .bind(identity.providerAccountId)
          .first<{ user_id: string }>();
        if (existing !== null && existing.user_id !== user.id) {
          throw new AccountLinkConflictError({
            provider: "github",
            providerAccountId: identity.providerAccountId,
            existingUserId: existing.user_id,
          });
        }
        await database.batch([
          database
            .prepare(
              "INSERT OR IGNORE INTO users (id, display_name, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(user.id, user.displayName, user.avatarUrl ?? null, now, now),
          database
            .prepare(
              "INSERT INTO oauth_accounts (provider, provider_account_id, user_id, provider_login, created_at, updated_at) VALUES ('github', ?, ?, ?, ?, ?)",
            )
            .bind(identity.providerAccountId, user.id, identity.login, now, now),
        ]);
        return user;
      },
      catch: (cause) =>
        cause instanceof AccountLinkConflictError ? cause : sessionFailure("create")(cause),
    }),
});

export const d1AccountStoreLayer = (database: D1Database) =>
  Layer.succeed(AccountStore, d1AccountStore(database));

export const d1MembershipStore = (database: D1Database): MembershipStoreShape => ({
  load: ({ userId, workspaceId, rfdId }) =>
    Effect.tryPromise({
      try: async () => {
        const workspace = await database
          .prepare(
            "SELECT owner_user_id, reviewer_can_merge FROM workspace_settings WHERE workspace_id = ?",
          )
          .bind(workspaceId)
          .first<{ owner_user_id: string; reviewer_can_merge: number }>();
        const membership =
          rfdId === undefined
            ? null
            : await database
                .prepare(
                  "SELECT role FROM rfd_memberships WHERE workspace_id = ? AND rfd_id = ? AND user_id = ?",
                )
                .bind(workspaceId, rfdId, userId)
                .first<{ role: "author" | "coauthor" | "reviewer" }>();
        return {
          workspaceOwner: workspace?.owner_user_id === userId,
          rfdRole: membership?.role,
          policy: { reviewerCanMerge: workspace?.reviewer_can_merge === 1 },
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
