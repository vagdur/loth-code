import { describe, expect, test } from "vitest";
import { escapeHtmlAttr, escapeHtmlText } from "../../src/assemblers/htmlEscape.js";

describe("escapeHtmlText", () => {
  test("escapes the three content-significant characters", () => {
    expect(escapeHtmlText('a & b < c > d "e" \'f\'')).toBe(
      "a &amp; b &lt; c &gt; d \"e\" 'f'",
    );
  });

  test("escapes & first, so entities are not double-built", () => {
    expect(escapeHtmlText("&lt;")).toBe("&amp;lt;");
  });

  test("leaves liturgical glyphs alone", () => {
    expect(escapeHtmlText("℣. Deus, in adiutórium — Halleluja.")).toBe(
      "℣. Deus, in adiutórium — Halleluja.",
    );
  });
});

describe("escapeHtmlAttr", () => {
  test("escapes quotes and newlines on top of the content set", () => {
    expect(escapeHtmlAttr('he said "hi"\nand left')).toBe(
      "he said &quot;hi&quot;&#10;and left",
    );
  });

  test("a multi-line GABC body round-trips", () => {
    const gabc = 'name:lauds-score-1;\n%%\n(c4) Gud,(j) kom(j) & "sing"(i)\n(::)';
    const escaped = escapeHtmlAttr(gabc);
    // Nothing that would end the attribute or the tag survives.
    expect(escaped).not.toContain('"');
    expect(escaped).not.toContain("<");
    expect(escaped).not.toContain("\n");

    const unescaped = escaped
      .replaceAll("&#10;", "\n")
      .replaceAll("&#13;", "\r")
      .replaceAll("&#39;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&gt;", ">")
      .replaceAll("&lt;", "<")
      .replaceAll("&amp;", "&");
    expect(unescaped).toBe(gabc);
  });
});
