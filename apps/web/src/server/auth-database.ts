import type { D1Database } from "@cloudflare/workers-types";
import type { DBAdapter, DBAdapterInstance, Where } from "better-auth/adapters";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

import { authSchema } from "./db/schema";

export const hashSessionToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hashTokenValue = async (value: Where["value"]): Promise<Where["value"]> => {
  if (typeof value === "string") {
    return hashSessionToken(value);
  }
  if (Array.isArray(value)) {
    if (value.every((item): item is string => typeof item === "string")) {
      return Promise.all(value.map((item) => hashSessionToken(item)));
    }
    return value;
  }
  return value;
};

const hashSessionWhere = async (model: string, where: readonly Where[]): Promise<Where[]> =>
  model === "session"
    ? Promise.all(
        where.map(async (condition) =>
          condition.field === "token"
            ? { ...condition, value: await hashTokenValue(condition.value) }
            : condition,
        ),
      )
    : [...where];

const rawTokenByDigest = async (
  model: string,
  where: readonly Where[],
): Promise<Map<string, string>> => {
  const tokens = where.flatMap((condition) => {
    if (model !== "session" || condition.field !== "token") return [];
    if (typeof condition.value === "string") return [condition.value];
    return Array.isArray(condition.value)
      ? condition.value.filter((value): value is string => typeof value === "string")
      : [];
  });
  return new Map(
    await Promise.all(tokens.map(async (token) => [await hashSessionToken(token), token] as const)),
  );
};

const restoreSessionToken = <A>(row: A, tokens: ReadonlyMap<string, string>): A => {
  if (row === null || typeof row !== "object" || !("token" in row)) return row;
  const token = row.token;
  if (typeof token !== "string") return row;
  const rawToken = tokens.get(token);
  return rawToken === undefined ? row : ({ ...row, token: rawToken } as A);
};

export const withHashedSessionTokens = (base: DBAdapter): DBAdapter => {
  return {
    ...base,
    create: async <T extends Record<string, any>, R = T>(input: {
      model: string;
      data: Omit<T, "id">;
      select?: string[] | undefined;
      forceAllowId?: boolean | undefined;
    }): Promise<R> => {
      if (input.model !== "session" || typeof input.data.token !== "string") {
        return base.create<T, R>(input);
      }
      const rawToken = input.data.token;
      const digest = await hashSessionToken(rawToken);
      const row = await base.create<T, R>({
        ...input,
        data: { ...input.data, token: digest },
      });
      return restoreSessionToken(row, new Map([[digest, rawToken]]));
    },
    findOne: async <T>(input: {
      model: string;
      where: Where[];
      select?: string[] | undefined;
      join?: Parameters<DBAdapter["findOne"]>[0]["join"];
    }): Promise<T | null> => {
      const tokens = await rawTokenByDigest(input.model, input.where);
      const row = await base.findOne<T>({
        ...input,
        where: await hashSessionWhere(input.model, input.where),
      });
      return restoreSessionToken(row, tokens);
    },
    findMany: async <T>(input: Parameters<DBAdapter["findMany"]>[0]): Promise<T[]> => {
      const where = input.where ?? [];
      const tokens = await rawTokenByDigest(input.model, where);
      const rows = await base.findMany<T>({
        ...input,
        where: await hashSessionWhere(input.model, where),
      });
      return rows.map((row) => restoreSessionToken(row, tokens));
    },
    count: async (input) =>
      base.count({
        ...input,
        where: await hashSessionWhere(input.model, input.where ?? []),
      }),
    update: async <T>(input: Parameters<DBAdapter["update"]>[0]): Promise<T | null> => {
      const tokens = await rawTokenByDigest(input.model, input.where);
      const updatedToken =
        input.model === "session" && typeof input.update.token === "string"
          ? input.update.token
          : undefined;
      const updatedDigest =
        updatedToken === undefined ? undefined : await hashSessionToken(updatedToken);
      if (updatedToken !== undefined && updatedDigest !== undefined) {
        tokens.set(updatedDigest, updatedToken);
      }
      const row = await base.update<T>({
        ...input,
        where: await hashSessionWhere(input.model, input.where),
        update:
          updatedDigest !== undefined ? { ...input.update, token: updatedDigest } : input.update,
      });
      return restoreSessionToken(row, tokens);
    },
    updateMany: async (input) =>
      base.updateMany({
        ...input,
        where: await hashSessionWhere(input.model, input.where),
        update:
          input.model === "session" && typeof input.update.token === "string"
            ? { ...input.update, token: await hashSessionToken(input.update.token) }
            : input.update,
      }),
    delete: async (input) =>
      base.delete({ ...input, where: await hashSessionWhere(input.model, input.where) }),
    deleteMany: async (input) =>
      base.deleteMany({ ...input, where: await hashSessionWhere(input.model, input.where) }),
    consumeOne: async <T>(input: Parameters<DBAdapter["consumeOne"]>[0]): Promise<T | null> => {
      const tokens = await rawTokenByDigest(input.model, input.where);
      const row = await base.consumeOne<T>({
        ...input,
        where: await hashSessionWhere(input.model, input.where),
      });
      return restoreSessionToken(row, tokens);
    },
    incrementOne: async <T>(input: Parameters<DBAdapter["incrementOne"]>[0]): Promise<T | null> => {
      const tokens = await rawTokenByDigest(input.model, input.where);
      const row = await base.incrementOne<T>({
        ...input,
        where: await hashSessionWhere(input.model, input.where),
      });
      return restoreSessionToken(row, tokens);
    },
  };
};

export const makeAuthDatabase = (database: D1Database): DBAdapterInstance => {
  const makeBase = drizzleAdapter(drizzle(database), {
    provider: "sqlite",
    schema: authSchema,
  });
  return (options) => withHashedSessionTokens(makeBase(options));
};
