import { createFileRoute } from "@tanstack/react-router";

import { rpcWebHandler } from "@/server/application/rpc-server";

export const Route = createFileRoute("/api/rpc")({
  server: {
    handlers: {
      POST: ({ request }) => rpcWebHandler.handler(request),
    },
  },
});
