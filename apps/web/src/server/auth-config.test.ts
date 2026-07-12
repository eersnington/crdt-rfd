import type { D1Database } from "@cloudflare/workers-types";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vite-plus/test";
import { createAuth, githubScopes } from "./auth-config.ts";
import { account } from "./db/schema.ts";

const database = {
  batch: async () => [],
  exec: async () => ({ count: 0, duration: 0 }),
  prepare: () => ({ bind: () => undefined }),
} as unknown as D1Database;

const auth = createAuth({
  DB: database,
  APP_ORIGIN: "https://rfd.example",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
  GITHUB_CLIENT_ID: "github-client",
  GITHUB_CLIENT_SECRET: "github-secret",
});

describe("Better Auth configuration", () => {
  it("uses the native D1 binding directly", () => {
    expect(auth.options.database).toBe(database);
  });

  it("configures GitHub identity scopes, encrypted OAuth tokens, and trusted origins", () => {
    expect(githubScopes).toEqual(["read:user", "user:email"]);
    expect(auth.options.baseURL).toBe("https://rfd.example");
    expect(auth.options.trustedOrigins).toEqual(["https://rfd.example"]);
    expect(auth.options.socialProviders?.github?.scope).toEqual([...githubScopes]);
    expect(auth.options.account?.encryptOAuthTokens).toBe(true);
  });

  it("declares provider and account identifiers as a composite unique constraint", () => {
    const constraint = getTableConfig(account).uniqueConstraints.find(
      ({ name }) => name === "account_provider_account_unique",
    );
    expect(constraint?.columns).toEqual([account.providerId, account.accountId]);
  });
});
