import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { expireCookie, readCookie } from "@/server/auth/cookies.ts";
import { logoutSession } from "@/server/auth/session.ts";
import { d1SessionStoreLayer } from "@/server/d1/adapters.ts";
import { cloudflareEnv } from "@/server/env.ts";

const sessionCookie = "__Host-rfd-session";

export const Route = createFileRoute("/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = readCookie(request.headers.get("cookie"), sessionCookie);
        if (token !== undefined)
          await Effect.runPromise(
            logoutSession(token).pipe(Effect.provide(d1SessionStoreLayer(cloudflareEnv.DB))),
          );
        return new Response(null, {
          status: 204,
          headers: { "Set-Cookie": expireCookie(sessionCookie), "Cache-Control": "no-store" },
        });
      },
    },
  },
});
