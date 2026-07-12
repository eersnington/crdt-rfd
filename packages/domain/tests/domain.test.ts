import { Result, Schema, SchemaParser } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";
import {
  BranchName,
  CommentAnchor,
  CommitSha,
  Permission,
  RfdPath,
  RfdStatus,
  canTransitionRfdStatus,
  hasPermission,
  parseRfdDocument,
  serializeRfdDocument,
  validateRfdCatalog,
} from "../src/index.ts";

const decode = <A, I>(schema: Schema.Codec<A, I, never>, value: unknown) =>
  SchemaParser.decodeUnknownResult(schema)(value);
const validSource = `---
number: 2
title: Storage Architecture
status: discussion
authors:
  - github:alice
created: 2026-07-12
updated: 2026-07-13
reviewers:
  - github:bob
supersedes: []
related:
  - 1
---
# Storage
`;

describe("Git and identifier values", () => {
  it("accepts generated safe branch names", () =>
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/), { minLength: 1, maxLength: 4 }),
        (parts) => {
          expect(decode(BranchName, parts.join("/"))._tag).toBe("Success");
        },
      ),
    ));

  it("rejects unsafe branches and paths", () => {
    for (const branch of ["", "/main", "main/", "a//b", "a..b", "topic.lock", "a b", "a@{b"]) {
      expect(Result.isFailure(decode(BranchName, branch))).toBe(true);
    }
    for (const path of [
      "/rfd/1.md",
      "../1.md",
      "rfd/../1.md",
      "rfd\\1.md",
      "rfd/1.txt",
      "rfd//1.md",
    ]) {
      expect(Result.isFailure(decode(RfdPath, path))).toBe(true);
    }
  });

  it("accepts generated repository-relative Markdown paths", () =>
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z][a-z0-9_-]{0,10}$/), { minLength: 1, maxLength: 5 }),
        (parts) => {
          expect(decode(RfdPath, `${parts.join("/")}.md`)._tag).toBe("Success");
        },
      ),
    ));
});

describe("RFD statuses", () => {
  const allowed = new Set([
    "draft:discussion",
    "discussion:accepted",
    "discussion:rejected",
    "accepted:superseded",
  ]);
  for (const from of RfdStatus.literals)
    for (const to of RfdStatus.literals) {
      it(`${from} -> ${to}`, () =>
        expect(canTransitionRfdStatus(from, to)).toBe(allowed.has(`${from}:${to}`)));
    }
});

describe("authorization", () => {
  const expected: Record<string, readonly string[]> = {
    "workspace-owner": Permission.literals,
    author: [
      "edit",
      "checkpoint",
      "comment",
      "create-proposal",
      "merge-proposal",
      "manage-members",
      "transfer-ownership",
    ],
    coauthor: ["edit", "checkpoint", "comment", "create-proposal"],
    reviewer: ["comment", "create-proposal"],
  };
  for (const role of ["workspace-owner", "author", "coauthor", "reviewer"] as const)
    for (const permission of Permission.literals) {
      it(`${role}: ${permission}`, () =>
        expect(hasPermission(role, permission, { reviewerCanMerge: false })).toBe(
          expected[role]!.includes(permission),
        ));
    }
  it("allows reviewer merge only through policy", () =>
    expect(hasPermission("reviewer", "merge-proposal", { reviewerCanMerge: true })).toBe(true));
});

describe("frontmatter", () => {
  it("parses body separately and serializes deterministically", () => {
    const parsed = Result.getOrThrow(parseRfdDocument(validSource));
    expect(parsed.body).toBe("# Storage\n");
    const serialized = serializeRfdDocument(parsed);
    expect(serializeRfdDocument(Result.getOrThrow(parseRfdDocument(serialized)))).toBe(serialized);
  });

  it("round-trips arbitrary Markdown bodies", () =>
    fc.assert(
      fc.property(fc.string(), (body) => {
        const parsed = Result.getOrThrow(parseRfdDocument(validSource));
        expect(
          Result.getOrThrow(parseRfdDocument(serializeRfdDocument({ ...parsed, body }))).body,
        ).toBe(body);
      }),
    ));

  it("rejects invalid status, unknown fields, malformed YAML, and missing authors", () => {
    for (const source of [
      validSource.replace("discussion", "pending"),
      validSource.replace("status: discussion", "status: discussion\nextra: true"),
      validSource.replace("authors:\n  - github:alice", "authors: []"),
      validSource.replace("number: 2", "number: ["),
    ])
      expect(Result.isFailure(parseRfdDocument(source))).toBe(true);
  });

  it("rejects duplicate numbers with a useful diagnostic", () => {
    const document = Result.getOrThrow(parseRfdDocument(validSource));
    const result = validateRfdCatalog([document, document]);
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure.message).toContain("Duplicate RFD number(s) 2");
  });
});

describe("later contracts", () => {
  it("validates both comment anchor variants", () => {
    const sha = "a".repeat(40);
    expect(Result.isSuccess(decode(CommitSha, sha))).toBe(true);
    expect(
      Result.isSuccess(
        decode(CommentAnchor, {
          _tag: "DocumentRange",
          branch: "main",
          start: new Uint8Array([1]),
          end: new Uint8Array([2]),
        }),
      ),
    ).toBe(true);
    expect(
      Result.isSuccess(
        decode(CommentAnchor, {
          _tag: "DiffLine",
          baseSha: sha,
          headSha: sha,
          side: "head",
          line: 1,
        }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        decode(CommentAnchor, {
          _tag: "DiffLine",
          baseSha: sha,
          headSha: sha,
          side: "head",
          line: 0,
        }),
      ),
    ).toBe(true);
  });
});
