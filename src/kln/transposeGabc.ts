/**
 * Shift every pitch in a GABC body up or down the staff.
 *
 * A *move* of the function inlined in `scripts/validate-kln-gabc.py`, not a
 * second implementation: nothing in Python calls it any more once the review
 * loop lives on the web, so there is no counterpart to drift from and nothing
 * for the parity check to compare.
 */

/** Chant staff letters, bottom to top. The same scale transcribe-kln-vector.py uses. */
const GABC_PITCH = "abcdefghijklm";

/** A clef: letter c or f, staff line 1-4, optional key signature such as "/b". */
const CLEF_INNER_RE = /^[cf][1-4](?:\/[a-g])?$/i;
const CLEF_LINE_RE = /^([cf])([1-4])(\/.*)?$/i;

/** A barline or breath mark, which has no pitch to move. */
const BAR_INNER_RE = /^[,;:`]+$/;

function shiftClef(inner: string, lineDelta: number): string {
  const match = CLEF_LINE_RE.exec(inner);
  if (!match) return inner;
  const [, letter, line, suffix] = match;
  const shifted = Math.max(1, Math.min(4, Number(line) + lineDelta));
  return `${letter}${shifted}${suffix ?? ""}`;
}

/**
 * Transpose the pitch letters inside one `(...)` group.
 *
 * Bracketed spans are copied through untouched: `[...]` carries positioning
 * and styling hints whose letters are not pitches, and shifting them would
 * corrupt the notation rather than transpose it.
 */
function transposeNeume(inner: string, steps: number): string {
  let out = "";
  let depth = 0;

  for (const char of inner) {
    if (char === "[") {
      depth += 1;
      out += char;
      continue;
    }
    if (char === "]" && depth > 0) {
      depth -= 1;
      out += char;
      continue;
    }
    if (depth > 0) {
      out += char;
      continue;
    }

    const lower = char.toLowerCase();
    const index = GABC_PITCH.indexOf(lower);
    if (index >= 0) {
      const shifted = Math.max(0, Math.min(GABC_PITCH.length - 1, index + steps));
      const letter = GABC_PITCH[shifted] as string;
      // A pitch letter that is not its own lowercase must have been uppercase.
      out += char === lower ? letter : letter.toUpperCase();
    } else {
      out += char;
    }
  }
  return out;
}

/**
 * Transpose a GABC body by `steps` staff positions.
 *
 * Clefs move half as far, since a staff line spans two pitches — so +2 pitches
 * with c3 becomes c4 and the notation reads the same. Barlines are left alone.
 * Pitches clamp at the ends of the staff rather than wrapping.
 */
export function transposeGabc(body: string, steps = 2): string {
  if (!steps) return body;
  // Floor, not truncate: Python's `steps // 2` rounds towards negative
  // infinity, so transposing down by an odd number moves the clef in Python
  // and would not here. `Math.trunc(-1 / 2)` is 0; `Math.floor(-1 / 2)` is -1.
  const clefDelta = Math.floor(steps / 2);

  return body.replace(/\(([^()]*)\)/g, (whole, inner: string) => {
    if (CLEF_INNER_RE.test(inner)) return `(${shiftClef(inner, clefDelta)})`;
    if (BAR_INNER_RE.test(inner)) return whole;
    return `(${transposeNeume(inner, steps)})`;
  });
}
