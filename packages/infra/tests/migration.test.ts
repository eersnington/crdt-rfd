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
  database.exec("INSERT INTO users VALUES ('u1', 'One', NULL, 1, 1), ('u2', 'Two', NULL, 1, 1)");
  database.exec("INSERT INTO workspace_settings VALUES ('w1', 'u1', 0, 1, 1)");
  return database;
};

describe("foundation migration", () => {
  it("applies from zero with all foundation tables", () => {
    const database = setup();
    const names = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .pluck()
      .all();
    expect(names).toEqual([
      "oauth_accounts",
      "rfd_memberships",
      "sessions",
      "users",
      "workspace_settings",
    ]);
  });

  it("enforces unique GitHub identities and hashed session tokens", () => {
    const database = setup();
    database.exec("INSERT INTO oauth_accounts VALUES ('github', '42', 'u1', 'one', 1, 1)");
    expect(() =>
      database.exec("INSERT INTO oauth_accounts VALUES ('github', '42', 'u2', 'two', 1, 1)"),
    ).toThrow(/UNIQUE/);
    expect(() =>
      database.exec("INSERT INTO sessions VALUES ('s1', 'u1', 'plaintext', 10, 1, NULL)"),
    ).toThrow(/CHECK/);
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
});
