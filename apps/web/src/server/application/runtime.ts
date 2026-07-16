import { Layer, ManagedRuntime } from "effect";

import { ApplicationLive } from "./layers";

export const applicationMemoMap = Layer.makeMemoMapUnsafe();

export const applicationRuntime = ManagedRuntime.make(ApplicationLive, {
  memoMap: applicationMemoMap,
});
