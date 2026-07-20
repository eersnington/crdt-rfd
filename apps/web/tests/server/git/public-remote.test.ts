import { describe, expect, it } from "vite-plus/test";

import { publicCloneRemote } from "../../../src/server/git/public-remote";

describe("publicCloneRemote", () => {
  it("keeps the Artifacts remote on loopback origins", () => {
    expect(
      publicCloneRemote({
        appOrigin: "http://localhost:6769",
        artifactRepoName: "rfd-abc",
        artifactRemote:
          "https://24de2a617a6739ba3ae9eea152a254a5.artifacts.cloudflare.net/git/crdt-rfd/rfd-abc.git",
      }),
    ).toBe(
      "https://24de2a617a6739ba3ae9eea152a254a5.artifacts.cloudflare.net/git/crdt-rfd/rfd-abc.git",
    );
  });

  it("brands production remotes onto APP_ORIGIN", () => {
    expect(
      publicCloneRemote({
        appOrigin: "https://rfd.eers.dev",
        artifactRepoName: "rfd-abc",
        artifactRemote:
          "https://24de2a617a6739ba3ae9eea152a254a5.artifacts.cloudflare.net/git/crdt-rfd/rfd-abc.git",
      }),
    ).toBe("https://rfd.eers.dev/git/rfd-abc.git");
  });
});
