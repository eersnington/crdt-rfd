import { getSchema, type JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { Result } from "effect";
import { MarkdownCompatibilityError } from "@crdt-rfd/domain";
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "y-prosemirror";
import type * as Y from "yjs";

export const editorExtensions = [StarterKit.configure({ undoRedo: false })];

const manager = new MarkdownManager({ extensions: editorExtensions });
const schema = getSchema(editorExtensions);

const unsupportedPatterns: ReadonlyArray<readonly [RegExp, string]> = [
  [/<[A-Za-z][^>]*>/, "embedded HTML"],
  [/^\s*\|.+\|\s*$/m, "tables"],
  [/!\[[^\]]*\]\([^)]*\)/, "images"],
  [/^\s*[-*+]\s+\[[ xX]\]\s+/m, "task lists"],
  [/^\s*\[\^[^\]]+\]:/m, "footnotes"],
  [/\{#[A-Za-z][^}]*\}/, "heading attributes"],
  [/<!--[\s\S]*?-->/, "HTML comments"],
  [/^(?: {4}|\t)\S/m, "indented code blocks"],
  [/^\s*\[[^\]]+\]:\s+\S+/m, "reference-style links"],
  [/~~[^~]+~~/, "strikethrough"],
];

export const parseEditorMarkdown = (
  source: string,
): Result.Result<JSONContent, MarkdownCompatibilityError> => {
  const unsupported = unsupportedPatterns.flatMap(([pattern, name]) =>
    pattern.test(source) ? [name] : [],
  );
  if (unsupported.length > 0) {
    return Result.fail(
      new MarkdownCompatibilityError({
        message:
          "This RFD contains Markdown the collaborative editor cannot preserve. The committed document remains unchanged.",
        unsupported,
      }),
    );
  }
  try {
    return Result.succeed(manager.parse(source));
  } catch (cause) {
    return Result.fail(
      new MarkdownCompatibilityError({
        message: `The RFD body could not be parsed as supported Markdown: ${cause instanceof Error ? cause.message : "unknown parser failure"}. The committed document remains unchanged.`,
        unsupported: [],
      }),
    );
  }
};

export const serializeEditorMarkdown = (
  document: JSONContent,
): Result.Result<string, MarkdownCompatibilityError> => {
  try {
    return Result.succeed(manager.serialize(document));
  } catch (cause) {
    return Result.fail(
      new MarkdownCompatibilityError({
        message: `The collaborative draft could not be serialized to Markdown: ${cause instanceof Error ? cause.message : "unknown serializer failure"}. The draft remains available.`,
        unsupported: [],
      }),
    );
  }
};

export const editorJsonToYDoc = (document: JSONContent): Y.Doc =>
  prosemirrorJSONToYDoc(schema, document, "content");

export const yDocToEditorJson = (document: Y.Doc): JSONContent =>
  yDocToProsemirrorJSON(document, "content");
