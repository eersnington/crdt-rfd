import { Effect, Result, Schema } from "effect";
import { RfdId } from "@crdt-rfd/domain";

import { applicationRuntime } from "../application/runtime";
import { SessionService } from "../application/session";
import { cloudflareEnv } from "../env";
import { RfdRepository } from "../rfds/repository";

export const connectRfdRoom = async (request: Request, rawRfdId: string): Promise<Response> => {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("Expected a WebSocket upgrade.", { status: 426 });
  }
  const rfdId = Schema.decodeUnknownResult(RfdId)(rawRfdId);
  if (Result.isFailure(rfdId)) return new Response("Invalid RFD identifier.", { status: 400 });

  const authorization = await applicationRuntime.runPromise(
    Effect.gen(function* () {
      const sessions = yield* SessionService;
      const repository = yield* RfdRepository;
      const session = yield* sessions.getCurrent(request.headers);
      if (session === null) return null;
      const role = yield* repository.getRoomRole(rfdId.success, session.user.id);
      return role === null ? null : { identity: { ...session.user, role } };
    }),
  );
  if (authorization === null) return new Response("RFD room access denied.", { status: 403 });

  const headers = new Headers(request.headers);
  headers.set("x-rfd-id", rfdId.success);
  headers.set(
    "x-room-identity",
    JSON.stringify({
      userId: authorization.identity.id,
      name: authorization.identity.name,
      role: authorization.identity.role,
    }),
  );
  return cloudflareEnv.RFD_ROOMS.getByName(rfdId.success).fetch(new Request(request, { headers }));
};
