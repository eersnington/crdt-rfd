import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { connectGitHubIdentity } from "@/server/auth/accounts.ts";
import { expireCookie, readCookie, secureCookie } from "@/server/auth/cookies.ts";
import { githubIdentityProviderLayer } from "@/server/auth/identity-provider.ts";
import { completeGitHubOAuth } from "@/server/auth/oauth.ts";
import { consumeOAuthTransaction } from "@/server/auth/oauth-transactions.ts";
import { issueSession } from "@/server/auth/session.ts";
import { d1AccountStoreLayer, d1SessionStoreLayer } from "@/server/d1/adapters.ts";
import { cloudflareEnv } from "@/server/env.ts";

const transactionCookie = "__Host-rfd-oauth";
const sessionCookie = "__Host-rfd-session";

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const transactionId = readCookie(request.headers.get("cookie"), transactionCookie);
        const transaction =
          transactionId === undefined
            ? undefined
            : await Effect.runPromise(consumeOAuthTransaction(cloudflareEnv.DB, transactionId));
        const query = new URL(request.url).searchParams;
        const identity = await Effect.runPromise(
          completeGitHubOAuth({ query, transaction, now: Date.now() }).pipe(
            Effect.provide(
              githubIdentityProviderLayer({
                clientId: cloudflareEnv.GITHUB_CLIENT_ID,
                clientSecret: cloudflareEnv.GITHUB_CLIENT_SECRET,
              }),
            ),
          ),
        );
        const user = await Effect.runPromise(
          connectGitHubIdentity(identity).pipe(
            Effect.provide(d1AccountStoreLayer(cloudflareEnv.DB)),
          ),
        );
        const issued = await Effect.runPromise(
          issueSession({ userId: user.id, now: Date.now(), ttlMs: 30 * 24 * 60 * 60_000 }).pipe(
            Effect.provide(d1SessionStoreLayer(cloudflareEnv.DB)),
          ),
        );
        const headers = new Headers({ Location: "/", "Cache-Control": "no-store" });
        headers.append("Set-Cookie", expireCookie(transactionCookie));
        headers.append(
          "Set-Cookie",
          secureCookie(sessionCookie, issued.token, { maxAge: 30 * 24 * 60 * 60 }),
        );
        return new Response(null, { status: 302, headers });
      },
    },
  },
});
