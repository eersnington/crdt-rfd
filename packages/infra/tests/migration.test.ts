import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const migration = readFileSync(
  fileURLToPath(new URL("../migrations/0001_foundation.sql", import.meta.url)),
  "utf8",
);

const setup = () => {
  const database = new Database(":memory:");
  database.exec(migration);
  database.exec(
    "INSERT INTO user VALUES ('u1', 'One', 'one@example.com', 1, NULL, 1, 1), ('u2', 'Two', 'two@example.com', 1, NULL, 1, 1)",
  );
  database.exec("INSERT INTO workspace_settings VALUES ('w1', 'u1', 0, 1, 1)");
  return database;
};

describe("foundation migration", () => {
  it("applies Better Auth and application tables from zero", () => {
    const database = setup();
    const names = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all();
    expect(names).toEqual([
      "account",
      "rfd_memberships",
      "session",
      "user",
      "verification",
      "workspace_settings",
    ]);
  });

  it("enforces unique provider accounts and session tokens", () => {
    const database = setup();
    database.exec(
      "INSERT INTO account VALUES ('a1', '42', 'github', 'u1', 'ciphertext', NULL, NULL, NULL, NULL, 'read:user user:email', NULL, 1, 1)",
    );
    expect(() =>
      database.exec(
        "INSERT INTO account VALUES ('a2', '42', 'github', 'u2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1)",
      ),
    ).toThrow(/UNIQUE/);
    database.exec("INSERT INTO session VALUES ('s1', 10, 'token', NULL, NULL, 'u1', 1, 1)");
    expect(() =>
      database.exec("INSERT INTO session VALUES ('s2', 10, 'token', NULL, NULL, 'u1', 1, 1)"),
    ).toThrow(/UNIQUE/);
  });

  it("prevents deleting or changing the last author", () => {
    const database = setup();
    database.exec("INSERT INTO rfd_memberships VALUES ('w1', 'r1', 'u1', 'author', 1, 1)");
    expect(() => database.exec("DELETE FROM rfd_memberships WHERE user_id = 'u1'")).toThrow(
      /retain at least one author/,
    );
    expect(() =>
      database.exec("UPDATE rfd_memberships SET role = 'reviewer' WHERE user_id = 'u1'"),
    ).toThrow(/retain at least one author/);
    database.exec("INSERT INTO rfd_memberships VALUES ('w1', 'r1', 'u2', 'author', 1, 1)");
    expect(() => database.exec("DELETE FROM rfd_memberships WHERE user_id = 'u1'")).not.toThrow();
  });

  it("requires the first RFD membership to be an author", () => {
    const database = setup();
    expect(() =>
      database.exec("INSERT INTO rfd_memberships VALUES ('w1', 'r1', 'u1', 'reviewer', 1, 1)"),
    ).toThrow(/first RFD membership must be an author/);
    database.exec("INSERT INTO rfd_memberships VALUES ('w1', 'r1', 'u1', 'author', 1, 1)");
    expect(() =>
      database.exec("INSERT INTO rfd_memberships VALUES ('w1', 'r1', 'u2', 'reviewer', 1, 1)"),
    ).not.toThrow();
    expect(() =>
      database.exec("UPDATE rfd_memberships SET rfd_id = 'r2' WHERE user_id = 'u2'"),
    ).toThrow(/cannot move to an RFD without an author/);
  });
});
