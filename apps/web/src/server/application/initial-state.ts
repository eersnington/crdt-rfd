import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { dehydrateAtom } from "@/lib/atom-hydration";
import { catalogAtom, sessionAtom } from "@/rpc/client";
import { RfdCatalog } from "./catalog";
import { applicationRuntime } from "./runtime";
import { SessionService } from "./session";

export const getInitialApplicationState = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const [catalogExit, sessionExit] = await Promise.all([
    applicationRuntime.runPromiseExit(Effect.flatMap(RfdCatalog, (catalog) => catalog.list)),
    applicationRuntime.runPromiseExit(
      Effect.flatMap(SessionService, (sessions) => sessions.getCurrent(headers)),
    ),
  ]);

  return [
    dehydrateAtom(catalogAtom, AsyncResult.fromExit(catalogExit)),
    dehydrateAtom(sessionAtom, AsyncResult.fromExit(sessionExit)),
  ];
});
