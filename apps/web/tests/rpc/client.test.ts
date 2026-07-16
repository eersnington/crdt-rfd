import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import * as Hydration from "effect/unstable/reactivity/Hydration";

import { dehydrateAtom } from "../../src/lib/atom-hydration";
import {
  catalogAtom,
  selectedLabelsAtom,
  selectedStatesAtom,
  sortedRfdsAtom,
} from "../../src/rpc/client";
import { RfdCatalog, RfdCatalogLive } from "../../src/server/application/catalog";

describe("RFD atoms", () => {
  it("hydrates the RPC catalog and derives filters and ordering", async () => {
    const catalog = await Effect.runPromise(
      Effect.flatMap(RfdCatalog, (service) => service.list).pipe(Effect.provide(RfdCatalogLive)),
    );
    const registry = AtomRegistry.make();

    Hydration.hydrate(registry, [dehydrateAtom(catalogAtom, AsyncResult.success(catalog))]);

    const initial = registry.get(sortedRfdsAtom);
    expect(initial).toHaveLength(catalog.length);
    expect(new Date(initial[0].updated).getTime()).toBeGreaterThanOrEqual(
      new Date(initial[1].updated).getTime(),
    );

    registry.set(selectedStatesAtom, new Set(["published"]));
    registry.set(selectedLabelsAtom, new Set(["workers"]));

    const filtered = registry.get(sortedRfdsAtom);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((rfd) => rfd.state === "published")).toBe(true);
    expect(filtered.every((rfd) => rfd.labels.includes("workers"))).toBe(true);
  });
});
