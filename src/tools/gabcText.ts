/**
 * Recovering plain text from GABC lyric syllables.
 *
 * GABC encodes words as whitespace-separated tokens; the syllables of one
 * word are adjacent `text(notes)` groups inside a single token
 * (`kyr(cf)kan(ed)` → "kyrkan"). Untexted tokens (clefs, barlines, tone
 * notes) reduce to an empty residue once note groups are stripped.
 */

/** Strip one whitespace token down to its lyric residue. */
function tokenResidue(token: string): string {
  return token
    .replace(/\([^)]*\)/g, "")     // note groups, clefs, divisiones
    .replace(/<sp>[^<]*<\/sp>/g, "") // special glyphs (V/. R/. crosses)
    .replace(/<\/?[a-z]+>/g, "")   // formatting tags (<i>, <b>, ...)
    .replace(/[{}]/g, "")          // elision braces
    .trim();
}

/** De-hyphenate a GABC body into plain text. */
export function gabcToText(gabc: string): string {
  const words: string[] = [];
  for (const token of gabc.split(/\s+/)) {
    const residue = tokenResidue(token);
    if (residue) words.push(residue);
  }
  return words.join(" ").replace(/\s+/g, " ").trim();
}

/** Case/punctuation-insensitive normalization for incipit comparison. */
export function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Lowercase and drop everything but letters/digits (spacing-insensitive form). */
function normalizeSpaceless(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * Does the recorded incipit agree with the de-hyphenated text?
 *
 * Raw incipits are not uniform: some are clean first words, others carry the
 * section label plus syllable-spaced OCR text. Comparison is therefore
 * spacing-insensitive: pass when the text starts with the incipit, or when
 * the incipit contains an opening chunk of the text (label-prefixed form).
 */
export function textMatchesIncipit(text: string, incipit: string): boolean {
  const t = normalizeSpaceless(text);
  const i = normalizeSpaceless(incipit);
  if (!i || !t) return true;
  if (t.startsWith(i)) return true;
  return i.includes(t.slice(0, Math.min(16, t.length)));
}
