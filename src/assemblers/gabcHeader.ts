/**
 * GABC header normalisation, shared by every renderer that emits scores.
 */

export interface GabcHeaderExtras {
  /** Gregorian mode 1–8. Written as a `mode:` header so Gregorio and exsurge
   *  can place it above the drop cap. */
  mode?: number;
}

/**
 * Ensure a GABC body is a complete, parseable score: both Gregorio and exsurge
 * expect a header section terminated by a `%%` line before the notation. Our
 * data stores notation-only bodies, so prepend a minimal `name:…;` header
 * unless the body already carries its own `%%` delimiter.
 *
 * `mode` is the Gregorio header that both GregorioTeX and exsurge (≥ 1.29.4)
 * draw above the drop cap. Bodies that already have a header are left alone.
 */
export function withGabcHeader(
  gabc: string,
  name: string,
  extras?: GabcHeaderExtras,
): string {
  if (/^%%\s*$/m.test(gabc)) return gabc;
  const lines = [`name:${name};`];
  if (extras?.mode !== undefined) lines.push(`mode: ${extras.mode};`);
  return `${lines.join("\n")}\n%%\n${gabc}`;
}
