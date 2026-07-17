import type { D1Database } from "@cloudflare/workers-types";
import Database from "better-sqlite3";
import type { DBAdapter, DBAdapterInstance } from "better-auth/adapters";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { memoryAdapter } from "better-auth/adapters/memory";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it, vi } from "vite-plus/test";

import { createAuth, type AuthEnvironment } from "../../src/server/auth-config";
import { withHashedSessionTokens } from "../../src/server/auth-database";
import { authSchema } from "../../src/server/db/schema";

const migration = readFileSync(
  fileURLToPath(
    new URL("../../../../packages/infra/migrations/0001_foundation.sql", import.meta.url),
  ),
  "utf8",
);

const environment: AuthEnvironment = {
  DB: {} as D1Database,
  APP_ORIGIN: "http://localhost",
  BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
  GITHUB_CLIENT_ID: "github-client",
  GITHUB_CLIENT_SECRET: "github-secret",
};

const makeAuth = () => {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  let adapter: DBAdapter | undefined;
  const database: DBAdapterInstance = (options) => {
    adapter = withHashedSessionTokens(memoryAdapter(tables)(options));
    return adapter;
  };
  return {
    auth: createAuth(environment, database),
    tables,
    getAdapter: () => {
      if (adapter === undefined) throw new Error("Expected Better Auth to initialize its adapter");
      return adapter;
    },
  };
};

const startOAuth = async (auth: ReturnType<typeof makeAuth>["auth"]) => {
  const response = await auth.handler(
    new Request("http://localhost/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/" }),
    }),
  );
  const body = (await response.json()) as { url: string };
  return { response, authorizationUrl: new URL(body.url) };
};

const cookieValue = (response: Response, name: string) => {
  const match = new RegExp(`${name}=([^;,]+)`).exec(response.headers.get("set-cookie") ?? "");
  return match === null ? undefined : `${name}=${match[1]}`;
};

const requiredCookie = (response: Response, name: string) => {
  const cookie = cookieValue(response, name);
  if (cookie === undefined) throw new Error(`Expected ${name} cookie`);
  return cookie;
};

const installGitHub = () => {
  const request = vi.fn(async (input: URL | RequestInfo) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith("https://github.com/login/oauth/access_token")) {
      return Response.json({
        access_token: "github-access-token",
        token_type: "bearer",
        scope: "read:user,user:email",
      });
    }
    if (url === "https://api.github.com/user") {
      return Response.json({
        id: 42,
        login: "ada",
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatar_url: "https://avatars.githubusercontent.com/u/42",
      });
    }
    if (url === "https://api.github.com/user/emails") {
      return Response.json([
        { email: "ada@example.com", primary: true, verified: true, visibility: "public" },
      ]);
    }
    throw new Error(`Unexpected GitHub request: ${url}`);
  });
  vi.stubGlobal("fetch", request);
};

const completeOAuth = async (auth: ReturnType<typeof makeAuth>["auth"]) => {
  const started = await startOAuth(auth);
  const state = started.authorizationUrl.searchParams.get("state");
  const stateCookie = cookieValue(started.response, "better-auth.oauth_state");
  return auth.handler(
    new Request(`http://localhost/api/auth/callback/github?code=code&state=${state}`, {
      redirect: "manual",
      headers: stateCookie === undefined ? {} : { cookie: stateCookie },
    }),
  );
};

describe("Better Auth configuration", () => {
  it("starts GitHub OAuth without repository scopes", async () => {
    const { response, authorizationUrl } = await startOAuth(makeAuth().auth);

    expect(response.status).toBe(200);
    expect(authorizationUrl.hostname).toBe("github.com");
    expect(authorizationUrl.searchParams.get("scope")).not.toMatch(/\brepo\b/);
    expect(response.headers.get("set-cookie")).toContain("better-auth.oauth_state");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
  });

  it("rejects an OAuth callback without its state cookie", async () => {
    const response = await makeAuth().auth.handler(
      new Request("http://localhost/api/auth/callback/github?code=code&state=missing", {
        redirect: "manual",
      }),
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toContain("error");
  });

  it("rejects expired OAuth state", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T00:00:00.000Z"));
    try {
      const { auth } = makeAuth();
      const started = await startOAuth(auth);
      const state = started.authorizationUrl.searchParams.get("state");
      const cookie = requiredCookie(started.response, "better-auth.oauth_state");
      vi.advanceTimersByTime(11 * 60 * 1_000);

      const response = await auth.handler(
        new Request(`http://localhost/api/auth/callback/github?code=code&state=${state}`, {
          redirect: "manual",
          headers: { cookie },
        }),
      );

      expect(response.status).toBeGreaterThanOrEqual(300);
      expect(response.status).toBeLessThan(400);
      expect(response.headers.get("location")).toContain("error");
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces provider denial without creating a session", async () => {
    const { auth } = makeAuth();
    const started = await startOAuth(auth);
    const state = started.authorizationUrl.searchParams.get("state");
    const cookie = started.response.headers.get("set-cookie")?.split(";", 1)[0];
    const response = await auth.handler(
      new Request(
        `http://localhost/api/auth/callback/github?error=access_denied&error_description=Denied&state=${state}`,
        { redirect: "manual", headers: cookie === undefined ? {} : { cookie } },
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("set-cookie") ?? "").not.toContain("session_token");
  });

  it("creates, rotates, expires, and logs out hashed sessions", async () => {
    installGitHub();
    const { auth, tables, getAdapter } = makeAuth();

    const firstLogin = await completeOAuth(auth);
    const firstCookie = requiredCookie(firstLogin, "better-auth.session_token");
    expect(tables.session).toHaveLength(1);
    expect(tables.session?.[0]?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(firstCookie).not.toContain(String(tables.session?.[0]?.token));

    const firstSession = await auth.api.getSession({
      headers: new Headers({ cookie: firstCookie }),
    });
    expect(firstSession?.user.email).toBe("ada@example.com");
    if (firstSession === null) throw new Error("Expected the first session to be active");

    const secondLogin = await completeOAuth(auth);
    const secondCookie = requiredCookie(secondLogin, "better-auth.session_token");
    expect(secondCookie).not.toBe(firstCookie);
    expect(tables.user).toHaveLength(1);
    expect(tables.account).toHaveLength(1);

    await getAdapter().update({
      model: "session",
      where: [{ field: "token", value: firstSession.session.token }],
      update: { expiresAt: new Date(0) },
    });
    const expired = await auth.api.getSession({
      headers: new Headers({ cookie: firstCookie }),
      query: { disableCookieCache: true },
    });
    expect(expired).toBeNull();

    await auth.handler(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: { cookie: secondCookie, "content-type": "application/json" },
        body: "{}",
      }),
    );
    const signedOut = await auth.api.getSession({
      headers: new Headers({ cookie: secondCookie }),
    });
    expect(signedOut).toBeNull();

    vi.unstubAllGlobals();
  });

  it("runs the OAuth and session flow through the production Drizzle schema", async () => {
    installGitHub();
    const sqlite = new Database(":memory:");
    try {
      sqlite.exec(migration);
      const makeDatabase = drizzleAdapter(drizzle(sqlite), {
        provider: "sqlite",
        schema: authSchema,
      });
      const database: DBAdapterInstance = (options) =>
        withHashedSessionTokens(makeDatabase(options));
      const auth = createAuth(environment, database);

      const login = await completeOAuth(auth);
      const cookie = requiredCookie(login, "better-auth.session_token");
      const row = sqlite.prepare("SELECT token, expires_at FROM session").get() as {
        token: string;
        expires_at: number;
      };

      expect(row.token).toMatch(/^[0-9a-f]{64}$/);
      expect(row.expires_at).toBeTypeOf("number");
      expect(cookie).not.toContain(row.token);
      await expect(
        auth.api.getSession({ headers: new Headers({ cookie }) }),
      ).resolves.toMatchObject({ user: { email: "ada@example.com" } });
    } finally {
      sqlite.close();
      vi.unstubAllGlobals();
    }
  });
});
