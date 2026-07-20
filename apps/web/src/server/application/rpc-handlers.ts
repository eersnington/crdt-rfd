import { Effect } from "effect";
import { RfdOperationFailed } from "@crdt-rfd/domain";

import { ApplicationRpc } from "../../rpc/contracts";
import { RfdCatalog } from "./catalog";
import { SessionService } from "./session";
import { RfdRepository } from "../rfds/repository";

export const ApplicationRpcLive = ApplicationRpc.toLayer(
  Effect.gen(function* () {
    const catalog = yield* RfdCatalog;
    const sessions = yield* SessionService;
    const repository = yield* RfdRepository;

    const headers = (options: { readonly headers: Readonly<Record<string, string>> }) =>
      new globalThis.Headers(Object.entries(options.headers));

    return {
      catalog_list: () => catalog.list(),
      rfd_create: (payload, options) =>
        sessions.getCurrent(headers(options)).pipe(
          Effect.mapError(
            () =>
              new RfdOperationFailed({
                operation: "authenticate RFD creation",
                message: "Your session could not be verified. Sign in again and retry.",
              }),
          ),
          Effect.flatMap((session) =>
            session === null
              ? Effect.fail(
                  new RfdOperationFailed({
                    operation: "authorize RFD creation",
                    message: "Sign in with GitHub before creating an RFD.",
                  }),
                )
              : repository.create(payload, session.user),
          ),
        ),
      rfd_get: (payload) => repository.get(payload.rfdId),
      rfd_getRef: (payload) => repository.getRef(payload),
      rfd_history: (payload) => repository.history(payload.rfdId),
      rfd_fork: (payload, options) =>
        sessions.getCurrent(headers(options)).pipe(
          Effect.mapError(
            () =>
              new RfdOperationFailed({
                operation: "authenticate RFD fork",
                message: "Your session could not be verified. Sign in again and retry.",
              }),
          ),
          Effect.flatMap((session) =>
            session === null
              ? Effect.fail(
                  new RfdOperationFailed({
                    operation: "authorize RFD fork",
                    message: "Sign in before creating a fork.",
                  }),
                )
              : repository.fork(payload, session.user),
          ),
        ),
      rfd_cloneCredential: (payload, options) =>
        sessions.getCurrent(headers(options)).pipe(
          Effect.mapError(
            () =>
              new RfdOperationFailed({
                operation: "authenticate clone credential",
                message: "Your session could not be verified. Sign in again and retry.",
              }),
          ),
          Effect.flatMap((session) =>
            session === null
              ? Effect.fail(
                  new RfdOperationFailed({
                    operation: "authorize clone credential",
                    message: "Sign in before generating a clone credential.",
                  }),
                )
              : repository.mintCloneCredential(payload, session.user),
          ),
        ),
      session_getCurrent: (_payload, options) => sessions.getCurrent(headers(options)),
    };
  }),
);
