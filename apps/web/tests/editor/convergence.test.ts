import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import * as Y from "yjs";

import { editorJsonToYDoc, parseEditorMarkdown, yDocToEditorJson } from "../../src/editor/markdown";
import { applyRoomUpdate, restoreRoomSnapshot } from "../../src/editor/room-state";

describe("collaborative RFD document", () => {
  it("converges body and metadata after concurrent updates", () => {
    const parsed = parseEditorMarkdown("# Shared\n\nInitial body.\n");
    if (Result.isFailure(parsed)) throw parsed.failure;
    const left = editorJsonToYDoc(parsed.success);
    const right = new Y.Doc();
    Y.applyUpdate(right, Y.encodeStateAsUpdate(left));

    left.getMap("metadata").set("title", "Left title");
    right.getMap("metadata").set("status", "discussion");
    const leftUpdate = Y.encodeStateAsUpdate(left, Y.encodeStateVector(right));
    const rightUpdate = Y.encodeStateAsUpdate(right, Y.encodeStateVector(left));
    Y.applyUpdate(left, rightUpdate);
    Y.applyUpdate(right, leftUpdate);
    Y.applyUpdate(right, leftUpdate);

    expect(Y.encodeStateVector(left)).toEqual(Y.encodeStateVector(right));
    expect(Object.fromEntries(left.getMap("metadata").entries())).toEqual({
      title: "Left title",
      status: "discussion",
    });
    expect(yDocToEditorJson(left)).toEqual(yDocToEditorJson(right));
  });

  it("restores a room snapshot and accepts a disconnected client's missing state", () => {
    const server = new Y.Doc();
    server.getMap("metadata").set("title", "Before disconnect");
    const persisted = Y.encodeStateAsUpdate(server);
    const client = restoreRoomSnapshot(persisted);

    client.getMap("metadata").set("title", "Edited while disconnected");
    const restartedServer = restoreRoomSnapshot(persisted);
    expect(applyRoomUpdate(restartedServer, Y.encodeStateAsUpdate(client))).toBe(true);
    expect(applyRoomUpdate(restartedServer, Y.encodeStateAsUpdate(client))).toBe(false);
    expect(restartedServer.getMap("metadata").get("title")).toBe("Edited while disconnected");
  });
});
