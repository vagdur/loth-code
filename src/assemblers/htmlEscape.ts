/**
 * Escape plain liturgical text for safe inclusion in HTML output.
 */

/** Escape for element content (`&`, `<`, `>`). */
export function escapeHtmlText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/**
 * Escape for a double-quoted attribute value. Also escapes `'` so the output is
 * safe if a host re-serializes with single quotes, and newlines so multi-line
 * GABC bodies survive `data-gabc` intact (the HTML parser would otherwise
 * normalize a literal CR to LF).
 */
export function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\r", "&#13;")
    .replaceAll("\n", "&#10;");
}
