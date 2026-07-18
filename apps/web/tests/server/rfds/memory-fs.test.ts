import { describe, expect, it } from "vite-plus/test";
import git from "isomorphic-git";

import { MemoryFS } from "../../../src/server/rfds/memory-fs";

describe("MemoryFS", () => {
  it("supports the isomorphic-git initialization and commit contract", async () => {
    const fs = new MemoryFS();
    const dir = "/workspace";

    await git.init({ fs, dir, defaultBranch: "main" });
    await fs.promises.writeFile(`${dir}/rfd.md`, "# Test RFD\n");
    await git.add({ fs, dir, filepath: "rfd.md" });
    const sha = await git.commit({
      fs,
      dir,
      message: "Create RFD",
      author: { name: "Test User", email: "test@example.com" },
    });

    expect(sha).toMatch(/^[0-9a-f]{40}$/);
    expect(await git.resolveRef({ fs, dir, ref: "HEAD" })).toBe(sha);
  });
});
