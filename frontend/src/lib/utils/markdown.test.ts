// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown.js";

describe("renderMarkdown", () => {
  describe("inline formatting", () => {
    it("renders bold text", () => {
      expect(renderMarkdown("**bold**")).toBe(
        "<p><strong>bold</strong></p>\n",
      );
    });

    it("renders italic text", () => {
      expect(renderMarkdown("*italic*")).toBe(
        "<p><em>italic</em></p>\n",
      );
    });

    it("renders inline code", () => {
      expect(renderMarkdown("`code`")).toBe(
        "<p><code>code</code></p>\n",
      );
    });

    it("renders links", () => {
      expect(renderMarkdown("[text](https://example.com)")).toBe(
        '<p><a href="https://example.com">text</a></p>\n',
      );
    });
  });

  describe("block elements", () => {
    it("renders headings", () => {
      expect(renderMarkdown("## Heading 2")).toBe(
        "<h2>Heading 2</h2>\n",
      );
    });

    it("renders unordered lists", () => {
      expect(renderMarkdown("- item one\n- item two")).toBe(
        "<ul>\n<li>item one</li>\n<li>item two</li>\n</ul>\n",
      );
    });

    it("renders ordered lists", () => {
      expect(renderMarkdown("1. first\n2. second")).toBe(
        "<ol>\n<li>first</li>\n<li>second</li>\n</ol>\n",
      );
    });

    it("renders blockquotes", () => {
      expect(renderMarkdown("> quoted text")).toBe(
        "<blockquote>\n<p>quoted text</p>\n</blockquote>\n",
      );
    });

    it("renders tables", () => {
      const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
      expect(renderMarkdown(md)).toBe(
        "<table>\n<thead>\n<tr>\n<th>A</th>\n<th>B</th>\n</tr>\n" +
          "</thead>\n<tbody><tr>\n<td>1</td>\n<td>2</td>\n</tr>\n" +
          "</tbody></table>\n",
      );
    });

    it("renders horizontal rules", () => {
      expect(renderMarkdown("---")).toBe("<hr>\n");
    });

    it("converts single newlines to <br>", () => {
      expect(renderMarkdown("line one\nline two")).toBe(
        "<p>line one<br>line two</p>\n",
      );
    });
  });

  describe("security and sanitization", () => {
    it("strips script tags (XSS)", () => {
      expect(renderMarkdown('<script>alert("xss")</script>')).toBe(
        "",
      );
    });

    it("strips event handlers (XSS)", () => {
      expect(
        renderMarkdown('<img src=x onerror="alert(1)">'),
      ).toBe('<img src="x">');
    });

    it("strips javascript: URLs (XSS)", () => {
      expect(
        renderMarkdown("[click](javascript:alert(1))"),
      ).toBe("<p><a>click</a></p>\n");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(renderMarkdown("")).toBe("");
    });

    it("passes through plain text", () => {
      expect(renderMarkdown("just plain text")).toBe(
        "<p>just plain text</p>\n",
      );
    });

    it("removes trailing newlines to prevent extra height", () => {
      expect(renderMarkdown("text\n\n")).toBe("<p>text</p>\n");
    });
  });
});
