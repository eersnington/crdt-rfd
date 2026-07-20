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
    DB: {
      prepare: () => ({
        all: () =>
          Promise.resolve({
            results: [
              {
                rfd_id: "test-rfd",
                number: 1,
                title: "D1 catalog",
                status: "draft",
                artifact_repo_name: "rfd-test-rfd",
                artifact_remote: "https://example.invalid/rfd-test-rfd.git",
                head_sha: "0123456789012345678901234567890123456789",
                committed_source: null,
                checkpoint_message: null,
                owner_user_id: "test-user",
                author: "Test User",
                updated_at: 1_700_000_000_000,
              },
            ],
          }),
      }),
    },
    ARTIFACTS: {},
  },
}));

import { dehydrateAtom } from "../../src/lib/atom-hydration";
import {
  catalogHydrationAtom,
  selectedLabelsAtom,
  selectedStatusesAtom,
  sortedRfdsAtom,
} from "../../src/rpc/client";
import { ApplicationRpc } from "../../src/rpc/contracts";
import { RfdCatalog, RfdCatalogLive } from "../../src/server/application/catalog";
import { RfdRepositoryLive } from "../../src/server/rfds/repository";
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
      expect(catalog).toHaveLength(1);
      expect(catalog[0]?.title).toBeTypeOf("string");
    } finally {
      await rpcWebHandler.dispose();
    }
  });

  it("hydrates the RPC catalog and derives filters and ordering", async () => {
    const catalog = await Effect.runPromise(
      Effect.flatMap(RfdCatalog, (service) => service.list()).pipe(
        Effect.provide(RfdCatalogLive.pipe(Layer.provide(RfdRepositoryLive))),
      ),
    );
    const registry = AtomRegistry.make();

    Hydration.hydrate(registry, [
      dehydrateAtom(catalogHydrationAtom, AsyncResult.success(catalog)),
    ]);

    const initial = registry.get(sortedRfdsAtom);
    expect(initial).toHaveLength(catalog.length);
    expect(initial[0]?.title).toBe("D1 catalog");

    registry.set(selectedStatusesAtom, new Set(["draft"]));
    registry.set(selectedLabelsAtom, new Set());

    const filtered = registry.get(sortedRfdsAtom);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((rfd) => rfd.status === "draft")).toBe(true);
  });
});
