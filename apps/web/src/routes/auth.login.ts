import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { beginGitHubOAuth } from "@/server/auth/oauth.ts";
import { saveOAuthTransaction } from "@/server/auth/oauth-transactions.ts";
import { randomToken } from "@/server/auth/crypto.ts";
import { secureCookie } from "@/server/auth/cookies.ts";
import { cloudflareEnv } from "@/server/env.ts";

const transactionCookie = "__Host-rfd-oauth";

export const Route = createFileRoute("/auth/login")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const redirectUri = new URL("/auth/callback", cloudflareEnv.APP_ORIGIN).href;
        const { url, transaction } = await beginGitHubOAuth({
          clientId: cloudflareEnv.GITHUB_CLIENT_ID,
          redirectUri,
          now,
        });
        const transactionId = randomToken();
        await Effect.runPromise(
          saveOAuthTransaction(cloudflareEnv.DB, transactionId, transaction, now),
        );
        return new Response(null, {
          status: 302,
          headers: {
            Location: url.href,
            "Set-Cookie": secureCookie(transactionCookie, transactionId, { maxAge: 600 }),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
