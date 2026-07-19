import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { RfdRoomProvider, roomWebSocketUrl } from "../../src/editor/room-provider";

class FakeWebSocket {
  static readonly OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readonly sent: unknown[] = [];
  readyState = FakeWebSocket.OPEN;
  binaryType = "";
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(message: unknown) {
    this.sent.push(message);
  }

  close(code = 1000, reason = "") {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}

describe("RfdRoomProvider lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    FakeWebSocket.instances = [];
  });

  it("remains usable after the Strict Mode mount-cleanup-mount cycle", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", host: "example.test" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const provider = new RfdRoomProvider("r1");

    provider.connect();
    provider.disconnect();
    provider.connect();
    provider.document.getMap("metadata").set("title", "Still connected");

    expect(FakeWebSocket.instances).toHaveLength(2);
    expect(FakeWebSocket.instances[1]?.sent).toHaveLength(1);
    provider.destroy();
  });

  it("uses the application origin for WebSocket upgrades", () => {
    const location = {
      protocol: "http:",
      host: "localhost:6769",
    };
    expect(roomWebSocketUrl("r1", location)).toBe("ws://localhost:6769/api/rfd/r1/room");
  });

  it("suppresses a transient startup failure", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { location: { protocol: "https:", host: "example.test" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const provider = new RfdRoomProvider("r1");

    provider.connect();
    FakeWebSocket.instances[0]?.close(1006);
    expect(provider.getSnapshot().error).toBeNull();

    vi.advanceTimersByTime(500);
    FakeWebSocket.instances[1]?.onopen?.();

    expect(provider.getSnapshot()).toMatchObject({ connection: "connected", error: null });
    provider.destroy();
  });

  it("reports a lost established connection", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", host: "example.test" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const provider = new RfdRoomProvider("r1");

    provider.connect();
    FakeWebSocket.instances[0]?.onopen?.();
    FakeWebSocket.instances[0]?.close(1006);

    expect(provider.getSnapshot().error).toBe("Room connection closed (1006). Retrying…");
    provider.destroy();
  });

  it("notifies the editor when a checkpoint commits", () => {
    vi.stubGlobal("window", { location: { protocol: "https:", host: "example.test" } });
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const onCheckpoint = vi.fn();
    const provider = new RfdRoomProvider("r1", onCheckpoint);

    provider.connect();
    FakeWebSocket.instances[0]?.onmessage?.({
      data: JSON.stringify({ type: "checkpoint" }),
    });

    expect(onCheckpoint).toHaveBeenCalledOnce();
    provider.destroy();
  });
});
