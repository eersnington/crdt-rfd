// @vitest-environment jsdom

import { Editor } from "@tiptap/core";
import Collaboration from "@tiptap/extension-collaboration";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vite-plus/test";
import * as Y from "yjs";

describe("Tiptap collaboration", () => {
  it("writes editor changes to the provided Yjs document", () => {
    const yDocument = new Y.Doc();
    const updates: Uint8Array[] = [];
    yDocument.on("update", (update) => updates.push(update));
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        Collaboration.configure({ document: yDocument, field: "content" }),
      ],
    });

    editor.commands.insertContent("hello there");

    expect(updates.length).toBeGreaterThan(0);
    expect(yDocument.getXmlFragment("content").length).toBeGreaterThan(0);
    editor.destroy();
    yDocument.destroy();
  });
});
