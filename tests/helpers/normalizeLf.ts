/** Normalize CRLF so fixture comparisons are stable across Windows and Unix. */
export function normalizeLf(s: string): string {
  return s.replace(/\r\n/g, "\n");
}
