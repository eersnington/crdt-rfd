import type { D1Database } from "@cloudflare/workers-types";
import { CommitSha, RfdId } from "@crdt-rfd/domain";
import { Effect, Result, Schema } from "effect";
import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("cloudflare:workers", () => ({ env: {} }));

import { makeRfdCatalogStore } from "../../../src/server/rfds/catalog-d1";

const databaseWithChanges = (changes: number, onBind?: (values: unknown[]) => void): D1Database => {
  const statement = {
    bind: (...values: unknown[]) => {
      onBind?.(values);
      return statement;
    },
    run: async () => ({ success: true, meta: { changes }, results: [] }),
    all: async () => ({ success: true, meta: { changes }, results: [] }),
    first: async () => null,
  };
  return {
    prepare: () => statement,
    batch: async (statements: ReadonlyArray<unknown>) =>
      Promise.all(statements.map(async () => ({ success: true, meta: { changes }, results: [] }))),
  } as unknown as D1Database;
};

const input = {
  rfdId: Schema.decodeUnknownSync(RfdId)("r1"),
  expectedHeadSha: Schema.decodeUnknownSync(CommitSha)("0".repeat(40)),
  nextHeadSha: Schema.decodeUnknownSync(CommitSha)("1".repeat(40)),
  title: "Collaborative editor",
  status: "draft" as const,
  committedSource: "---\nnumber: 1\n---\n",
  checkpointMessage: "Clarify edit semantics",
  authorName: "Ada Lovelace",
  timestamp: 1,
};

describe("RfdCatalogStore checkpoint", () => {
  it("advances the catalog only from the expected committed head", async () => {
    const bindings: unknown[][] = [];
    await expect(
      Effect.runPromise(
        makeRfdCatalogStore(
          databaseWithChanges(1, (values) => bindings.push(values)),
        ).commitCheckpoint(input),
      ),
    ).resolves.toBeUndefined();
    expect(bindings[0]).toContain("Clarify edit semantics");
    expect(bindings[1]).toEqual([
      input.rfdId,
      input.nextHeadSha,
      "Clarify edit semantics",
      "Ada Lovelace",
      1,
      input.committedSource,
    ]);
  });

  it("reports a conflict when the committed head changed", async () => {
    const result = await Effect.runPromise(
      Effect.result(makeRfdCatalogStore(databaseWithChanges(0)).commitCheckpoint(input)),
    );
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("CatalogCheckpointConflict");
  });
});
