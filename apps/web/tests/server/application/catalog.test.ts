import { describe, expect, it, vi } from "vite-plus/test";
import { Effect, Layer } from "effect";

vi.mock("cloudflare:workers", () => ({
  env: {
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
  },
}));

import { RfdCatalog, RfdCatalogLive } from "../../../src/server/application/catalog";
import { RfdRepositoryLive } from "../../../src/server/rfds/repository";

describe("RfdCatalog", () => {
  it("decodes the D1 catalog through the domain schema", async () => {
    const catalog = await Effect.runPromise(
      Effect.flatMap(RfdCatalog, (service) => service.list()).pipe(
        Effect.provide(RfdCatalogLive.pipe(Layer.provide(RfdRepositoryLive))),
      ),
    );

    expect(catalog).toHaveLength(1);
    expect(catalog.every((rfd) => rfd.number > 0)).toBe(true);
    expect(catalog[0]?.title).toBe("D1 catalog");
  });
});
