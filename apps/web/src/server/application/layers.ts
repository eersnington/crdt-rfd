import { Layer } from "effect";

import { RfdCatalogLive } from "./catalog";
import { SessionServiceLive } from "./session-live";
import { RfdRepositoryLive } from "../rfds/repository";
import { BetterAuthLive } from "../auth-service";

const InfrastructureLive = Layer.mergeAll(RfdRepositoryLive, BetterAuthLive);

export const ApplicationLive = Layer.provideMerge(
  Layer.mergeAll(RfdCatalogLive, SessionServiceLive),
  InfrastructureLive,
);
