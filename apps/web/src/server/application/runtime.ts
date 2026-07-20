import { ManagedRuntime } from "effect";

import { ApplicationLive } from "./layers";

export const applicationRuntime = ManagedRuntime.make(ApplicationLive);
