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

  it("rejects operations that would corrupt directory entries", async () => {
    const fs = new MemoryFS();
    await fs.promises.mkdir("/workspace", { recursive: true });
    await fs.promises.writeFile("/workspace/rfd.md", "# RFD\n");

    await expect(fs.promises.mkdir("/workspace/rfd.md")).rejects.toMatchObject({ code: "EEXIST" });
    await expect(fs.promises.writeFile("/workspace", "invalid")).rejects.toMatchObject({
      code: "EISDIR",
    });
    await expect(fs.promises.rmdir("/")).rejects.toMatchObject({ code: "EBUSY" });
  });
});
