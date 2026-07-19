import { Result } from "effect";
import { generateHTML } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";

import { parseEditorMarkdown } from "../../editor/markdown";

export function RfdReader({ source }: { readonly source: string }) {
  const parsed = parseEditorMarkdown(source);
  const html = Result.isSuccess(parsed)
    ? generateHTML(parsed.success, [StarterKit.configure({ undoRedo: false }), Markdown])
    : `<p>${source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`;
  return <div className="document-prose mt-10" dangerouslySetInnerHTML={{ __html: html }} />;
}
