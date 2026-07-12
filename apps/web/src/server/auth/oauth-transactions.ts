import type { D1Database } from "@cloudflare/workers-types";
import { Effect } from "effect";
import { sha256 } from "./crypto.ts";
import { SessionStoreError } from "./errors.ts";
import type { OAuthTransaction } from "./oauth.ts";

const failure = (operation: "create" | "read" | "delete", cause: unknown) =>
  new SessionStoreError({
    operation,
    message: `D1 OAuth transaction ${operation} failed: ${String(cause)}`,
  });

export const saveOAuthTransaction = (
  database: D1Database,
  id: string,
  transaction: OAuthTransaction,
  now: number,
) =>
  Effect.tryPromise({
    try: async () => {
      const idHash = await sha256(id);
      await database
        .prepare(
          "INSERT INTO oauth_transactions (id_hash, state, verifier, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(idHash, transaction.state, transaction.verifier, transaction.expiresAt, now)
        .run();
    },
    catch: (cause) => failure("create", cause),
  });

export const consumeOAuthTransaction = (database: D1Database, id: string) =>
  Effect.tryPromise({
    try: async () => {
      const idHash = await sha256(id);
      const row = await database
        .prepare(
          "DELETE FROM oauth_transactions WHERE id_hash = ? RETURNING state, verifier, expires_at",
        )
        .bind(idHash)
        .first<{ state: string; verifier: string; expires_at: number }>();
      return row === null
        ? undefined
        : ({
            state: row.state,
            verifier: row.verifier,
            expiresAt: row.expires_at,
          } satisfies OAuthTransaction);
    },
    catch: (cause) => failure("delete", cause),
  });
