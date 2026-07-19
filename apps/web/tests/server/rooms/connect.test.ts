import { describe, expect, it } from "vite-plus/test";

import { roomIdFromRequest } from "../../../src/server/rooms/path";

describe("RFD room Worker dispatch", () => {
  it("matches only the dedicated room endpoint", () => {
    expect(roomIdFromRequest(new Request("https://example.test/api/rfd/rfd-1/room"))).toBe("rfd-1");
    expect(roomIdFromRequest(new Request("https://example.test/api/rfd/rfd-1"))).toBeNull();
    expect(roomIdFromRequest(new Request("https://example.test/api/rpc"))).toBeNull();
  });
});
