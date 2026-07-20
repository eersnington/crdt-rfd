import { Effect, Layer } from "effect";

import { BetterAuthService } from "../auth-service";
import { makeSessionService, SessionService } from "./session";

export const SessionServiceLive = Layer.effect(
  SessionService,
  Effect.map(BetterAuthService, (auth) => SessionService.of(makeSessionService(auth.getSession))),
);
