import { describe, expect, it } from "vite-plus/test";
import { Effect } from "effect";

import { RfdCatalog, RfdCatalogLive } from "../../../src/server/application/catalog";

describe("RfdCatalog", () => {
  it("decodes the server-owned catalog through the domain schema", async () => {
    const catalog = await Effect.runPromise(
      Effect.flatMap(RfdCatalog, (service) => service.list).pipe(Effect.provide(RfdCatalogLive)),
    );

    expect(catalog).toHaveLength(15);
    expect(catalog.every((rfd) => rfd.number > 0)).toBe(true);
    expect(catalog.some((rfd) => rfd.labels.includes("workers"))).toBe(true);
  });
});
