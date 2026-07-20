import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { authHandlers } from "@/server/auth-handlers.ts";
import { BetterAuthService } from "@/server/auth-service.ts";
import { applicationRuntime } from "@/server/application/runtime";

const handlers = authHandlers({
  handler: (request) =>
    applicationRuntime.runPromise(
      Effect.flatMap(BetterAuthService, (auth) => auth.handle(request)),
    ),
});

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers,
  },
});
