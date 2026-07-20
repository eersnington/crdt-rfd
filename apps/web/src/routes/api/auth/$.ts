import { createFileRoute } from "@tanstack/react-router";
import { authHandlers } from "@/server/auth-handlers.ts";
import { getAuth } from "@/server/auth.ts";

const handlers = authHandlers({
  handler: (request) => getAuth().handler(request),
});

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers,
  },
});
