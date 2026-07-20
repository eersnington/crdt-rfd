import { Result, Schema, SchemaParser } from "effect";
import fc from "fast-check";
import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import {
  BranchName,
  CommentAnchor,
  CommitSha,
  GitRef,
  Permission,
  Proposal,
  RfdPath,
  RfdStatus,
  type RfdId,
  type UserId,
  WorkspaceId,
  canTransitionRfdStatus,
  describeAutoCheckpointMessage,
  nextRfdStatuses,
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
  it("keeps identifier brands nominally distinct", () => {
    expectTypeOf<UserId>().not.toEqualTypeOf<WorkspaceId>();
    expectTypeOf<UserId>().not.toEqualTypeOf<RfdId>();
  });

  it("accepts generated identifiers and rejects malformed boundaries", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/), (identifier) => {
        expect(Result.isSuccess(decode(WorkspaceId, identifier))).toBe(true);
      }),
    );
    for (const identifier of ["", "-leading", "has:colon", `a${"b".repeat(128)}`]) {
      expect(Result.isFailure(decode(WorkspaceId, identifier))).toBe(true);
    }
  });

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
    for (const ref of [
      "refs/heads/a..b",
      "refs/heads/topic.lock",
      "refs/heads/a/../b",
      "refs/heads/a\u0000b",
    ]) {
      expect(Result.isFailure(decode(GitRef, ref))).toBe(true);
    }
    for (const path of [
      "/rfd/1.md",
      "../1.md",
      "rfd/../1.md",
      "rfd\\1.md",
      "rfd/1.txt",
      "rfd//1.md",
      "rfd/a\u0000b.md",
      "rfd/a b.md",
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

  it("lists only legal next statuses", () => {
    expect(nextRfdStatuses("draft")).toEqual(["discussion"]);
    expect(nextRfdStatuses("discussion")).toEqual(["accepted", "rejected"]);
    expect(nextRfdStatuses("accepted")).toEqual(["superseded"]);
    expect(nextRfdStatuses("rejected")).toEqual([]);
    expect(nextRfdStatuses("superseded")).toEqual([]);
  });
});

describe("auto checkpoint messages", () => {
  const base = { title: "RFD Test", status: "draft" as const, body: "hello\n" };

  it("describes status-only changes", () => {
    expect(describeAutoCheckpointMessage(base, { ...base, status: "discussion" })).toBe(
      "Status → Discussion",
    );
  });

  it("describes title renames", () => {
    expect(describeAutoCheckpointMessage(base, { ...base, title: "New title" })).toBe(
      "Rename to “New title”",
    );
  });

  it("describes body updates", () => {
    expect(describeAutoCheckpointMessage(base, { ...base, body: "goodbye\n" })).toBe("Update body");
  });

  it("joins multiple changes", () => {
    expect(
      describeAutoCheckpointMessage(base, {
        title: "Ship it",
        status: "discussion",
        body: "updated\n",
      }),
    ).toBe("Status → Discussion; Rename to “Ship it”; Update body");
  });

  it("falls back when nothing changed", () => {
    expect(describeAutoCheckpointMessage(base, base)).toBe("Update RFD");
    expect(describeAutoCheckpointMessage(null, base)).toBe("Update RFD");
  });
});

describe("authorization", () => {
  const expected: Record<string, readonly string[]> = {
    "workspace-owner": Permission.literals,
    owner: [
      "edit",
      "checkpoint",
      "comment",
      "create-proposal",
      "merge-proposal",
      "manage-members",
      "transfer-ownership",
    ],
    editor: ["edit", "checkpoint", "comment", "create-proposal"],
    commenter: ["comment", "create-proposal"],
  };
  for (const role of ["workspace-owner", "owner", "editor", "commenter"] as const)
    for (const permission of Permission.literals) {
      it(`${role}: ${permission}`, () =>
        expect(hasPermission(role, permission, { reviewerCanMerge: false })).toBe(
          expected[role]!.includes(permission),
        ));
    }
  it("allows commenter merge only through policy", () =>
    expect(hasPermission("commenter", "merge-proposal", { reviewerCanMerge: true })).toBe(true));
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

  it("rejects impossible calendar dates", () => {
    for (const date of ["2026-00-01", "2026-02-29", "2026-13-01", "2026-04-31"]) {
      expect(Result.isFailure(parseRfdDocument(validSource.replace("2026-07-12", date)))).toBe(
        true,
      );
    }
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
  it("rejects proposals with equal branches or incomplete failure details", () => {
    const sha = "a".repeat(40);
    const proposal = {
      sourceBranch: "main",
      sourceCommit: sha,
      targetBranch: "main",
      headCommit: sha,
      source: { _tag: "Human", userId: "user_1" },
      summary: "Revise storage",
      status: "open",
    };

    expect(Result.isFailure(decode(Proposal, proposal))).toBe(true);
    expect(
      Result.isFailure(
        decode(Proposal, { ...proposal, targetBranch: "proposal/storage", status: "failed" }),
      ),
    ).toBe(true);
    expect(
      Result.isSuccess(
        decode(Proposal, {
          ...proposal,
          targetBranch: "proposal/storage",
          status: "failed",
          diagnostic: "The model request timed out.",
        }),
      ),
    ).toBe(true);
  });

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
