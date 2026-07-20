import { describe, expect, it } from "vite-plus/test";

import { gitProxyTargetFromRequest } from "../../../src/server/git/path";

describe("git proxy path parsing", () => {
  it("parses branded repo remotes with .git suffix", () => {
    expect(
      gitProxyTargetFromRequest(
        new Request("https://rfd.eers.dev/git/rfd-abc.git/info/refs?service=git-upload-pack"),
      ),
    ).toEqual({
      repoName: "rfd-abc",
      rest: "/info/refs",
    });
  });

  it("parses upload-pack posts", () => {
    expect(
      gitProxyTargetFromRequest(
        new Request("https://rfd.eers.dev/git/rfd-abc.git/git-upload-pack", { method: "POST" }),
      ),
    ).toEqual({
      repoName: "rfd-abc",
      rest: "/git-upload-pack",
    });
  });

  it("accepts remotes without .git", () => {
    expect(
      gitProxyTargetFromRequest(new Request("https://rfd.eers.dev/git/rfd-abc/info/refs")),
    ).toEqual({
      repoName: "rfd-abc",
      rest: "/info/refs",
    });
  });

  it("ignores non-git routes", () => {
    expect(gitProxyTargetFromRequest(new Request("https://rfd.eers.dev/rfd/abc"))).toBeNull();
    expect(gitProxyTargetFromRequest(new Request("https://rfd.eers.dev/api/rpc"))).toBeNull();
  });
});
