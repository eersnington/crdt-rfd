import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Effect, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";

import { dehydrateAtom } from "@/lib/atom-hydration";
import { catalogHydrationAtom, rfdDocumentAtom, sessionAtom } from "@/rpc/client";
import { RfdId } from "@crdt-rfd/domain";
import { RfdCatalog } from "./catalog";
import { applicationRuntime } from "./runtime";
import { SessionService } from "./session";
import { RfdRepository } from "../rfds/repository";

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

export const getRfdInitialApplicationState = createServerFn({ method: "GET" })
  .validator((input: { readonly rfdId: string }) => ({
    rfdId: Schema.decodeUnknownSync(RfdId)(input.rfdId),
  }))
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const [documentExit, sessionExit] = await applicationRuntime.runPromise(
      Effect.all(
        [
          Effect.exit(Effect.flatMap(RfdRepository, (repository) => repository.get(data.rfdId))),
          Effect.exit(Effect.flatMap(SessionService, (sessions) => sessions.getCurrent(headers))),
        ],
        { concurrency: "unbounded" },
      ),
    );

    return [
      dehydrateAtom(rfdDocumentAtom(data.rfdId), AsyncResult.fromExit(documentExit)),
      dehydrateAtom(sessionAtom, AsyncResult.fromExit(sessionExit)),
    ];
  });
