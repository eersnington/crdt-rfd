import type { D1Database } from "@cloudflare/workers-types";
import { CommitSha, RfdId } from "@crdt-rfd/domain";
import { Effect, Result, Schema } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { makeRfdCatalogStore } from "../../../src/server/rfds/catalog-d1";

const databaseWithChanges = (changes: number): D1Database =>
  ({
    prepare: () => ({
      bind: () => ({ run: async () => ({ success: true, meta: { changes }, results: [] }) }),
    }),
  }) as unknown as D1Database;

const input = {
  rfdId: Schema.decodeUnknownSync(RfdId)("r1"),
  expectedHeadSha: Schema.decodeUnknownSync(CommitSha)("0".repeat(40)),
  nextHeadSha: Schema.decodeUnknownSync(CommitSha)("1".repeat(40)),
  title: "Collaborative editor",
  status: "draft" as const,
  committedSource: "---\nnumber: 1\n---\n",
  timestamp: 1,
};

describe("RfdCatalogStore checkpoint", () => {
  it("advances the catalog only from the expected committed head", async () => {
    await expect(
      Effect.runPromise(makeRfdCatalogStore(databaseWithChanges(1)).commitCheckpoint(input)),
    ).resolves.toBeUndefined();
  });

  it("reports a conflict when the committed head changed", async () => {
    const result = await Effect.runPromise(
      Effect.result(makeRfdCatalogStore(databaseWithChanges(0)).commitCheckpoint(input)),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("CatalogCheckpointConflict");
  });
});
