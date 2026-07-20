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
                forked_from_rfd_id: null,
                forked_from_sha: null,
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
import { makeRfdCatalogStore } from "../../../src/server/rfds/catalog-d1";
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

  it("stores fork lineage in the catalog insert", async () => {
    const statements: Array<string> = [];
    const statement = {
      bind: () => statement,
      run: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
      all: async () => ({ success: true, meta: { changes: 1 }, results: [] }),
    };
    const database = {
      prepare: (sql: string) => {
        statements.push(sql);
        return statement;
      },
      batch: () => Promise.resolve([]),
    };
    const catalog = makeRfdCatalogStore(database as never);

    await Effect.runPromise(
      catalog.insert({
        rfdId: "fork-rfd" as never,
        number: 2 as never,
        title: "Forked RFD",
        artifactRepoName: "rfd-fork-rfd",
        artifactRemote: "https://example.invalid/rfd-fork-rfd.git",
        headSha: "0123456789012345678901234567890123456789" as never,
        committedSource: "---\nnumber: 2\n---\n",
        ownerUserId: "test-user" as never,
        authorName: "Ada Lovelace",
        timestamp: 1_700_000_000_000,
        forkedFrom: {
          rfdId: "source-rfd" as never,
          sha: "0123456789012345678901234567890123456789" as never,
        },
      }),
    );

    expect(statements.some((statement) => statement.includes("INSERT INTO rfd_catalog"))).toBe(
      true,
    );
    expect(
      statements
        .find((statement) => statement.includes("INSERT INTO rfd_catalog"))
        ?.replace(/\s+/g, " "),
    ).toContain(
      "committed_source, checkpoint_message, forked_from_rfd_id, forked_from_sha, owner_user_id",
    );
  });
});
