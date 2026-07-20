import { Layer } from "effect";

import { RfdCatalogLive } from "./catalog";
import { SessionServiceLive } from "./session-live";

export const ApplicationLive = Layer.mergeAll(RfdCatalogLive, SessionServiceLive);
