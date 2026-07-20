import { Context, Layer, ManagedRuntime } from "effect";

import { createAuth } from "./auth-config";
import { cloudflareEnv } from "./env";

export interface BetterAuthServiceShape {
  readonly instance: ReturnType<typeof createAuth>;
}

export class BetterAuthService extends Context.Service<BetterAuthService, BetterAuthServiceShape>()(
  "crdt-rfd/BetterAuthService",
) {}

export const BetterAuthLive = Layer.sync(BetterAuthService, () => ({
  instance: createAuth(cloudflareEnv),
}));

export const betterAuthRuntime = ManagedRuntime.make(BetterAuthLive);
