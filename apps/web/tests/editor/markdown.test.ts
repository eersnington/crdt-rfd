import { describe, expect, it } from "vite-plus/test";
import { Result } from "effect";

import {
  editorJsonToYDoc,
  parseEditorMarkdown,
  serializeEditorMarkdown,
  yDocToEditorJson,
} from "../../src/editor/markdown";

const supported = `# Editor fixture

Paragraph with **bold**, *emphasis*, [a link](https://example.com), and \`inline code\`.

- one
- two

1. first
2. second

> quoted

\`\`\`ts
const value = 1
\`\`\`

---
`;

describe("editor Markdown", () => {
  it("preserves the supported document structure through Markdown and Yjs", () => {
    const parsed = parseEditorMarkdown(supported);
    expect(Result.isSuccess(parsed)).toBe(true);
    if (Result.isFailure(parsed)) return;

    const ydoc = editorJsonToYDoc(parsed.success);
    const serialized = serializeEditorMarkdown(yDocToEditorJson(ydoc));

    expect(Result.isSuccess(serialized)).toBe(true);
    if (Result.isFailure(serialized)) return;
    const reparsed = parseEditorMarkdown(serialized.success);
    expect(reparsed).toEqual(parsed);
  });

  it("rejects unsupported Markdown without rewriting it", () => {
    for (const [source, construct] of [
      ["| a | b |\n|---|---|\n| 1 | 2 |\n", "tables"],
      ["![diagram](diagram.png)\n", "images"],
      ["- [ ] unfinished\n", "task lists"],
      ["<!-- hidden -->\n", "HTML comments"],
      ["    indented code\n", "indented code blocks"],
      ["[label]: https://example.com\n\n[label]\n", "reference-style links"],
    ] as const) {
      const result = parseEditorMarkdown(source);
      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) expect(result.failure.unsupported).toContain(construct);
    }
  });
});
