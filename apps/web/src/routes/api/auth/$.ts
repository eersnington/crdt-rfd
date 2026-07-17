import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { authHandlers } from "@/server/auth-handlers.ts";
import { betterAuthRuntime, BetterAuthService } from "@/server/auth-service.ts";

const handlers = authHandlers({
  handler: (request) =>
    betterAuthRuntime.runPromise(
      Effect.flatMap(BetterAuthService, ({ instance }) =>
        Effect.promise(() => instance.handler(request)),
      ),
    ),
});

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers,
  },
});
