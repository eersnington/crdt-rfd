import { Layer } from "effect";

import { getAuth } from "../auth";
import { makeSessionService, SessionService } from "./session";

export const SessionServiceLive = Layer.succeed(SessionService)(
  SessionService.of(makeSessionService((headers) => getAuth().api.getSession({ headers }))),
);
