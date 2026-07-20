import { Effect, Layer } from "effect";

import { betterAuthRuntime, BetterAuthService } from "../auth-service";
import { makeSessionService, SessionService } from "./session";

export const SessionServiceLive = Layer.succeed(
  SessionService,
  SessionService.of(
    makeSessionService((headers) =>
      betterAuthRuntime.runPromise(
        Effect.flatMap(BetterAuthService, ({ instance }) =>
          Effect.promise(() => instance.api.getSession({ headers })),
        ),
      ),
    ),
  ),
);
