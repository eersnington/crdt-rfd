import type { DBAdapter, Where } from "better-auth/adapters";
import { describe, expect, it } from "vite-plus/test";

import { hashSessionToken, withHashedSessionTokens } from "../../src/server/auth-database";

describe("hashed session adapter", () => {
  it("stores only a digest while returning the raw cookie token", async () => {
    const writes: Array<Record<string, unknown>> = [];
    const base = {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        writes.push(data);
        return data;
      },
    } as unknown as DBAdapter;
    const adapter = withHashedSessionTokens(base);

    const session = await adapter.create<Record<string, unknown>>({
      model: "session",
      data: { token: "raw-session-token", userId: "user_1" },
    });

    expect(session.token).toBe("raw-session-token");
    expect(writes).toEqual([
      { token: await hashSessionToken("raw-session-token"), userId: "user_1" },
    ]);
  });

  it("hashes lookup and deletion predicates and restores lookup results", async () => {
    const queries: Where[][] = [];
    const digest = await hashSessionToken("raw-session-token");
    const base = {
      findOne: async ({ where }: { where: Where[] }) => {
        queries.push(where);
        return { token: digest, userId: "user_1" };
      },
      delete: async ({ where }: { where: Where[] }) => {
        queries.push(where);
      },
    } as unknown as DBAdapter;
    const adapter = withHashedSessionTokens(base);

    const session = await adapter.findOne<{ token: string; userId: string }>({
      model: "session",
      where: [{ field: "token", value: "raw-session-token" }],
    });
    await adapter.delete({
      model: "session",
      where: [{ field: "token", value: "raw-session-token" }],
    });

    expect(session).toEqual({ token: "raw-session-token", userId: "user_1" });
    expect(queries).toEqual([
      [{ field: "token", value: digest }],
      [{ field: "token", value: digest }],
    ]);
  });

  it("never accepts a stored digest as a bearer token", async () => {
    const digest = await hashSessionToken("raw-session-token");
    const queries: Where[][] = [];
    const base = {
      findOne: async ({ where }: { where: Where[] }) => {
        queries.push(where);
        return null;
      },
    } as unknown as DBAdapter;
    const adapter = withHashedSessionTokens(base);

    const session = await adapter.findOne({
      model: "session",
      where: [{ field: "token", value: digest }],
    });

    expect(session).toBeNull();
    expect(queries).toEqual([[{ field: "token", value: await hashSessionToken(digest) }]]);
  });
});
