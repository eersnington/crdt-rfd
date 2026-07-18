import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { dehydrateAtom } from "@/lib/atom-hydration";
import { catalogHydrationAtom, sessionAtom } from "@/rpc/client";
import { RfdCatalog } from "./catalog";
import { applicationRuntime } from "./runtime";
import { SessionService } from "./session";

export const getInitialApplicationState = createServerFn({ method: "GET" }).handler(async () => {
  const headers = getRequestHeaders();
  const [catalogExit, sessionExit] = await applicationRuntime.runPromise(
    Effect.all(
      [
        Effect.exit(Effect.flatMap(RfdCatalog, (catalog) => catalog.list())),
        Effect.exit(Effect.flatMap(SessionService, (sessions) => sessions.getCurrent(headers))),
      ],
      { concurrency: "unbounded" },
    ),
  );

  return [
    dehydrateAtom(catalogHydrationAtom, AsyncResult.fromExit(catalogExit)),
    dehydrateAtom(sessionAtom, AsyncResult.fromExit(sessionExit)),
  ];
});
