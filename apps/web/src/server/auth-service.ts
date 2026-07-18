import { Context, Effect, Layer, Schema } from "effect";

import { createAuth } from "./auth-config";
import { cloudflareEnv } from "./env";

export interface BetterAuthServiceShape {
  readonly instance: ReturnType<typeof createAuth>;
  readonly getSession: (
    headers: Headers,
  ) => Effect.Effect<
    Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["getSession"]>>,
    BetterAuthRequestFailed
  >;
  readonly handle: (request: Request) => Effect.Effect<Response, BetterAuthRequestFailed>;
}

export class BetterAuthRequestFailed extends Schema.TaggedErrorClass<BetterAuthRequestFailed>()(
  "BetterAuthRequestFailed",
  { operation: Schema.Literals(["getSession", "handle"]), cause: Schema.Defect() },
) {}

export class BetterAuthService extends Context.Service<BetterAuthService, BetterAuthServiceShape>()(
  "crdt-rfd/BetterAuthService",
) {}

const instance = createAuth(cloudflareEnv);

export const BetterAuthLive = Layer.succeed(
  BetterAuthService,
  BetterAuthService.of({
    instance,
    getSession: Effect.fn("BetterAuthService.getSession")((headers: Headers) =>
      Effect.tryPromise({
        try: () => instance.api.getSession({ headers }),
        catch: (cause) => new BetterAuthRequestFailed({ operation: "getSession", cause }),
      }),
    ),
    handle: Effect.fn("BetterAuthService.handle")((request: Request) =>
      Effect.tryPromise({
        try: () => instance.handler(request),
        catch: (cause) => new BetterAuthRequestFailed({ operation: "handle", cause }),
      }),
    ),
  }),
);
