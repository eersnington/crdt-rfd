import { Effect, Layer } from "effect";

import { ApplicationRpc } from "@/rpc/contracts";
import { RfdCatalog } from "./catalog";
import { ApplicationLive } from "./layers";
import { SessionService } from "./session";

export const ApplicationRpcLive = ApplicationRpc.toLayer(
  Effect.gen(function* () {
    const catalog = yield* RfdCatalog;
    const sessions = yield* SessionService;

    return {
      catalog_list: () => catalog.list,
      session_getCurrent: (_payload, options) =>
        sessions.getCurrent(new globalThis.Headers(options.headers as Record<string, string>)),
    };
  }),
).pipe(Layer.provide(ApplicationLive));
