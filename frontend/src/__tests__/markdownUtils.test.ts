import { stabilizeStreamingMarkdown, renderSafeMarkdown } from "../utils/markdownUtils";

describe("markdownUtils", () => {
  describe("stabilizeStreamingMarkdown", () => {
    it("returns raw text unchanged when isStreaming is false", () => {
      const input = "```typescript\nconst a = 1;";
      expect(stabilizeStreamingMarkdown(input, false)).toBe(input);
    });

    it("stabilizes unclosed code fences while streaming", () => {
      const partial = "```python\ndef hello():\n    return 'world'";
      const stabilized = stabilizeStreamingMarkdown(partial, true);
      expect(stabilized).toBe(partial + "\n```");
    });

    it("does not alter properly closed code fences while streaming", () => {
      const closed = "```python\ndef hello():\n    return 'world'\n```";
      const stabilized = stabilizeStreamingMarkdown(closed, true);
      expect(stabilized).toBe(closed);
    });

    it("stabilizes unclosed bold text while streaming", () => {
      const partial = "This is **very important";
      const stabilized = stabilizeStreamingMarkdown(partial, true);
      expect(stabilized).toBe("This is **very important**");
    });

    it("stabilizes unclosed inline code on the trailing line", () => {
      const partial = "Use the `fetch()";
      const stabilized = stabilizeStreamingMarkdown(partial, true);
      expect(stabilized).toBe("Use the `fetch()`");
    });
  });

  describe("renderSafeMarkdown", () => {
    it("renders formatted paragraphs and headers", () => {
      const md = "### Header\nThis is a paragraph.";
      const html = renderSafeMarkdown(md);
      expect(html).toContain("<h3>Header</h3>");
      expect(html).toContain("<p>This is a paragraph.</p>");
    });

    it("renders syntax-highlighted code blocks with copy button", () => {
      const md = "```javascript\nconst x = 42;\n```";
      const html = renderSafeMarkdown(md);
      expect(html).toContain("code-block-wrapper");
      expect(html).toContain("code-copy-btn");
      expect(html).toContain("language-javascript");
      expect(html).toContain("hljs");
    });

    it("adds streaming badge to active open code blocks when streaming is true", () => {
      const partialMd = "```typescript\ninterface User { id: string;";
      const html = renderSafeMarkdown(partialMd, true);
      expect(html).toContain("code-streaming-badge");
      expect(html).toContain("Generating…");
    });

    it("sanitizes unsafe script tags and dangerous hrefs", () => {
      const dangerous = "<script>alert('hack')</script><a href=\"javascript:alert('xss')\">link</a>";
      const html = renderSafeMarkdown(dangerous);
      expect(html).not.toContain("<script>");
      expect(html).not.toContain("javascript:");
    });
  });
});
