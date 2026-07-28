/**
 * GABC header normalisation, shared by every renderer that emits scores.
 */

/**
 * Ensure a GABC body is a complete, parseable score: both Gregorio and exsurge
 * expect a header section terminated by a `%%` line before the notation. Our
 * data stores notation-only bodies, so prepend a minimal `name:…;` header
 * unless the body already carries its own `%%` delimiter.
 */
export function withGabcHeader(gabc: string, name: string): string {
  if (/^%%\s*$/m.test(gabc)) return gabc;
  return `name:${name};\n%%\n${gabc}`;
}
