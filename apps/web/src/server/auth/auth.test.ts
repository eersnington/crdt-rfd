import { Effect, Layer } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { connectGitHubIdentity, inMemoryAccountStoreLayer } from "./accounts.ts";
import { expireCookie, readCookie, secureCookie } from "./cookies.ts";
import { sha256 } from "./crypto.ts";
import { IdentityProvider } from "./identity-provider.ts";
import { beginGitHubOAuth, completeGitHubOAuth } from "./oauth.ts";
import {
  inMemorySessionStoreLayer,
  issueSession,
  logoutSession,
  readSession,
  rotateSession,
} from "./session.ts";

const identity = {
  provider: "github" as const,
  providerAccountId: "42",
  login: "octo",
  displayName: "Octo",
};

describe("GitHub OAuth", () => {
  it("requests identity-only scopes and PKCE", async () => {
    const result = await beginGitHubOAuth({
      clientId: "client",
      redirectUri: "https://app.test/callback",
      now: 1,
    });
    expect(result.url.searchParams.get("scope")).toBe("read:user user:email");
    expect(result.url.searchParams.get("scope")).not.toContain("repo");
    expect(result.url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it.each([
    ["mismatch", new URLSearchParams({ code: "code", state: "wrong" }), 1],
    ["expired", new URLSearchParams({ code: "code", state: "state" }), 11],
  ] as const)("returns a tagged %s state failure", async (reason, query, now) => {
    const error = await Effect.runPromise(
      completeGitHubOAuth({
        query,
        transaction: { state: "state", verifier: "verifier", expiresAt: 10 },
        now,
      }).pipe(
        Effect.provide(
          Layer.succeed(IdentityProvider, {
            exchangeCode: () => Effect.succeed("token"),
            loadIdentity: () => Effect.succeed(identity),
          }),
        ),
        Effect.flip,
      ),
    );
    expect(error).toMatchObject({ _tag: "OAuthStateError", reason });
  });

  it("returns provider denial without exchanging a code", async () => {
    const error = await Effect.runPromise(
      completeGitHubOAuth({
        query: new URLSearchParams({ error: "access_denied", state: "state" }),
        transaction: { state: "state", verifier: "verifier", expiresAt: 2 },
        now: 1,
      }).pipe(
        Effect.provide(
          Layer.succeed(IdentityProvider, {
            exchangeCode: () => Effect.succeed("token"),
            loadIdentity: () => Effect.succeed(identity),
          }),
        ),
        Effect.flip,
      ),
    );
    expect(error).toMatchObject({ _tag: "OAuthProviderDeniedError", code: "access_denied" });
  });
});

describe("cookies", () => {
  it("sets and clears hardened cookies", () => {
    const cookie = secureCookie("session", "secret", { maxAge: 60 });
    expect(cookie).toContain("HttpOnly; Secure; SameSite=Lax");
    expect(readCookie("other=x; session=secret", "session")).toBe("secret");
    expect(expireCookie("session")).toContain("Max-Age=0");
  });
});

describe("sessions", () => {
  it("hashes, reads, rotates, expires, and logs out sessions", async () => {
    const program = Effect.gen(function* () {
      const issued = yield* issueSession({ userId: "u1", now: 10, ttlMs: 100 });
      expect(issued.session.tokenHash).toBe(yield* Effect.promise(() => sha256(issued.token)));
      expect(issued.session.tokenHash).not.toContain(issued.token);
      expect((yield* readSession(issued.token, 20))?.userId).toBe("u1");
      const rotated = yield* rotateSession(issued.token, 30, 100);
      expect(yield* readSession(issued.token, 31)).toBeUndefined();
      expect(yield* readSession(rotated!.token, 31)).toBeDefined();
      yield* logoutSession(rotated!.token);
      expect(yield* readSession(rotated!.token, 32)).toBeUndefined();
      const expiring = yield* issueSession({ userId: "u1", now: 40, ttlMs: 1 });
      expect(yield* readSession(expiring.token, 41)).toBeUndefined();
    }).pipe(Effect.provide(inMemorySessionStoreLayer));
    await Effect.runPromise(program);
  });
});

describe("account linking", () => {
  it("reconnects the same account and rejects linking it to another user", async () => {
    const program = Effect.gen(function* () {
      const created = yield* connectGitHubIdentity(identity);
      expect((yield* connectGitHubIdentity(identity)).id).toBe(created.id);
      return yield* Effect.flip(
        connectGitHubIdentity(identity, { id: "other", displayName: "Other" }),
      );
    }).pipe(Effect.provide(inMemoryAccountStoreLayer));
    const error = await Effect.runPromise(program);
    expect(error._tag).toBe("AccountLinkConflictError");
  });
});
