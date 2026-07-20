import * as Y from "yjs";

export const applyRoomUpdate = (document: Y.Doc, update: Uint8Array, origin?: unknown): boolean => {
  const before = Y.encodeStateVector(document);
  Y.applyUpdate(document, update, origin);
  const after = Y.encodeStateVector(document);
  return !(
    before.byteLength === after.byteLength && before.every((byte, index) => byte === after[index])
  );
};

export const restoreRoomSnapshot = (snapshot: Uint8Array): Y.Doc => {
  const document = new Y.Doc();
  Y.applyUpdate(document, snapshot);
  return document;
};
