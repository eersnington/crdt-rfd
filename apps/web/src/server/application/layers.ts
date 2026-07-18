import { Layer } from "effect";

import { RfdCatalogLive } from "./catalog";
import { SessionServiceLive } from "./session-live";
import { RfdRepositoryLive } from "../rfds/repository";

export const ApplicationLive = Layer.mergeAll(
  RfdCatalogLive,
  RfdRepositoryLive,
  SessionServiceLive,
);
