/**
 * Escape plain liturgical text for safe inclusion in LaTeX bodies (LuaLaTeX).
 */

export function escapeTexPlain(text: string): string {
  return text
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("$", "\\$")
    .replaceAll("&", "\\&")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("%", "\\%")
    .replaceAll("~", "\\textasciitilde{}")
    .replaceAll("^", "\\textasciicircum{}");
}
