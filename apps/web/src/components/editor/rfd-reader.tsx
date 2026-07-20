const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderInlineMarkdown = (source: string) =>
  escapeHtml(source)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

const isBlockStart = (line: string) => /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s?|```|---+$)/.test(line);

const renderMarkdown = (source: string) => {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  const blocks: string[] = [];
  for (let index = 0; index < lines.length; ) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(
        `<pre><code${language === "" ? "" : ` class="language-${escapeHtml(language)}"`}>${escapeHtml(code.join("\n"))}</code></pre>`,
      );
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading !== null) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^---+$/.test(line)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }
    const list = /^([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (list !== null) {
      const ordered = /\d+\./.test(list[1]);
      const items: string[] = [];
      const pattern = ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/;
      while (index < lines.length) {
        const item = pattern.exec(lines[index]);
        if (item === null) break;
        items.push(`<li>${renderInlineMarkdown(item[1])}</li>`);
        index += 1;
      }
      blocks.push(`<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].startsWith(">")) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(`<blockquote><p>${renderInlineMarkdown(quote.join(" "))}</p></blockquote>`);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() !== "" && !isBlockStart(lines[index])) {
      paragraph.push(lines[index++]);
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join("\n"))}</p>`);
  }
  return blocks.join("\n");
};

export function RfdReader({ source }: { readonly source: string }) {
  return (
    <div
      className="document-prose mt-10"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }}
    />
  );
}
