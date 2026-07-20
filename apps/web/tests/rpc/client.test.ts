import { describe, expect, it, vi } from "vite-plus/test";
import { Effect, Layer } from "effect";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Hydration from "effect/unstable/reactivity/Hydration";
import * as RpcClient from "effect/unstable/rpc/RpcClient";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";

vi.mock("cloudflare:workers", () => ({
  env: {
    APP_ORIGIN: "http://localhost",
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-better-auth",
    GITHUB_CLIENT_ID: "test-client",
    GITHUB_CLIENT_SECRET: "test-secret",
    DB: {},
  },
}));

import { dehydrateAtom } from "../../src/lib/atom-hydration";
import {
  catalogAtom,
  selectedLabelsAtom,
  selectedStatusesAtom,
  sortedRfdsAtom,
} from "../../src/rpc/client";
import { ApplicationRpc } from "../../src/rpc/contracts";
import { RfdCatalog, RfdCatalogLive } from "../../src/server/application/catalog";
import { rpcWebHandler } from "../../src/server/application/rpc-server";

describe("RFD atoms", () => {
  it("round-trips the catalog through the production RPC handler", async () => {
    const customFetch: typeof fetch = Object.assign(
      async (input: URL | RequestInfo, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init);
        return rpcWebHandler.handler(request);
      },
      { preconnect: () => undefined },
    );
    const clientLayer = RpcClient.layerProtocolHttp({ url: "http://localhost/api/rpc" }).pipe(
      Layer.provideMerge([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, customFetch)),
    );

    try {
      const catalog = await Effect.runPromise(
        Effect.flatMap(RpcClient.make(ApplicationRpc), (client) =>
          client.catalog_list(undefined),
        ).pipe(Effect.provide(clientLayer), Effect.scoped),
      );
      expect(catalog).toHaveLength(15);
      expect(catalog[0]?.title).toBeTypeOf("string");
    } finally {
      await rpcWebHandler.dispose();
    }
  });

  it("hydrates the RPC catalog and derives filters and ordering", async () => {
    const catalog = await Effect.runPromise(
      Effect.flatMap(RfdCatalog, (service) => service.list()).pipe(Effect.provide(RfdCatalogLive)),
    );
    const registry = AtomRegistry.make();

    Hydration.hydrate(registry, [dehydrateAtom(catalogAtom, AsyncResult.success(catalog))]);

    const initial = registry.get(sortedRfdsAtom);
    expect(initial).toHaveLength(catalog.length);
    expect(new Date(initial[0].updated).getTime()).toBeGreaterThanOrEqual(
      new Date(initial[1].updated).getTime(),
    );

    registry.set(selectedStatusesAtom, new Set(["accepted"]));
    registry.set(selectedLabelsAtom, new Set(["workers"]));

    const filtered = registry.get(sortedRfdsAtom);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((rfd) => rfd.status === "accepted")).toBe(true);
    expect(filtered.every((rfd) => rfd.labels.includes("workers"))).toBe(true);
  });
});
