import { createFileRoute } from "@tanstack/react-router";
import { authHandlers } from "@/server/auth-handlers.ts";
import { auth } from "@/server/auth.ts";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: authHandlers(auth),
  },
});
