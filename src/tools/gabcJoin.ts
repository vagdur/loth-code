/**
 * Join separately stored GABC bodies into one score for display.
 *
 * Data stores dialogues and short responsories as named sections (one GABC
 * body each). Printed books present those sections as a single block, with
 * ℣./℟. labels and, for the short responsory, the repeat written out. This
 * module is the string-level half of that reassembly; liturgical part order
 * lives in `src/assemblers/gabcDisplay.ts`.
 */

export type GabcPrefix = "V" | "R" | "VR";
export type GabcAttach = "line" | "inline";

export interface GabcSegment {
  gabc: string;
  prefix?: GabcPrefix;
  /** How this segment attaches to the previous one. Default `line`. */
  attach?: GabcAttach;
}

const CLEF_INNER = /^[cf]b?[1-5](?:\/[a-g])?$/i;
const TRAILING_BAR_RE = /\s*\([,;:`]+\)\s*$/;
const BAR_AT_END_RE = /\([,;:`]+\)\s*$/;
const BREAK_AT_END_RE = /\(Z\)\s*$/;
const SP_PREFIX_RE = /^<sp>[VR]\/<\/sp>/i;

const SP_V = "<sp>V/</sp>";
const SP_R = "<sp>R/</sp>";
const SP_VR = "<sp>V/</sp>+<sp>R/</sp>";

/** Drop a `name:…; %%` header so a stored body and an already-headed score join the same way. */
export function notationBody(gabc: string): string {
  const idx = gabc.search(/^%%\s*$/m);
  if (idx < 0) return gabc.trim();
  return gabc.slice(idx).replace(/^%%\s*/, "").trim();
}

/** Leading clef token, if the body starts with one. */
export function splitClef(gabc: string): { clef: string; body: string } {
  const trimmed = gabc.trim();
  const m = /^\(([^()]*)\)/.exec(trimmed);
  if (!m || !CLEF_INNER.test(m[1] ?? "")) return { clef: "", body: trimmed };
  return { clef: m[0], body: trimmed.slice(m[0].length).trim() };
}

export function stripTrailingBar(body: string): string {
  return body.replace(TRAILING_BAR_RE, "").trim();
}

function endsWithBar(body: string): boolean {
  return BAR_AT_END_RE.test(body.trim());
}

function endsWithBreak(body: string): boolean {
  return BREAK_AT_END_RE.test(body.trim());
}

function ensureDoubleBar(body: string): string {
  const t = body.trim();
  if (/\(::\)\s*$/.test(t) || endsWithBreak(t)) return t;
  return `${t} (::)`;
}

function ensureFinalBar(body: string): string {
  const t = body.trim();
  if (endsWithBar(t) || endsWithBreak(t)) return t;
  return `${t} (::)`;
}

function hasSpecialPrefix(body: string): boolean {
  return SP_PREFIX_RE.test(body.trim());
}

function prefixTag(prefix: GabcPrefix): string {
  if (prefix === "V") return SP_V;
  if (prefix === "R") return SP_R;
  return SP_VR;
}

/** Insert a ℣./℟. special before the first syllable, unless one is already there. */
export function applyPrefix(body: string, prefix: GabcPrefix | undefined): string {
  const trimmed = body.trim();
  if (!prefix || !trimmed || hasSpecialPrefix(trimmed)) return trimmed;
  return `${prefixTag(prefix)}${trimmed}`;
}

function applyPrefixToScore(gabc: string, prefix: GabcPrefix | undefined): string {
  const { clef, body } = splitClef(gabc);
  const prefixed = applyPrefix(body, prefix);
  return clef ? `${clef} ${prefixed}` : prefixed;
}

/** Drop a leading clef that repeats the score's opening clef; keep a change of clef. */
export function stripMatchingClef(gabc: string, clef: string): string {
  const { clef: next, body } = splitClef(gabc);
  if (!next || (clef && next === clef)) return body;
  return gabc.trim();
}

function glueInline(prev: string, next: string): string {
  const left = prev.trim();
  if (endsWithBar(left) || endsWithBreak(left)) return `${left} ${next}`;
  return `${left} (:) ${next}`;
}

function glueLine(prev: string, next: string): string {
  const left = ensureDoubleBar(prev.trim());
  return `${left} (Z)\n${next}`;
}

/**
 * Concatenate GABC segments into one body.
 *
 * The first segment's clef is kept; later segments lose a matching clef.
 * `attach: "line"` starts a new staff (`(::) (Z)`); `"inline"` continues the
 * current staff, inserting `(:)` when the previous part has no bar.
 */
export function joinGabc(segments: readonly GabcSegment[]): string {
  const prepared: GabcSegment[] = [];
  for (const s of segments) {
    const gabc = notationBody(s.gabc);
    if (!gabc) continue;
    prepared.push({
      gabc,
      ...(s.prefix ? { prefix: s.prefix } : {}),
      ...(s.attach ? { attach: s.attach } : {}),
    });
  }

  if (prepared.length === 0) return "";

  const first = prepared[0]!;
  if (prepared.length === 1) {
    return ensureFinalBar(applyPrefixToScore(first.gabc, first.prefix));
  }

  const { clef, body: firstBody } = splitClef(first.gabc);
  let acc = applyPrefixToScore(
    clef ? `${clef} ${firstBody}` : firstBody,
    first.prefix,
  );

  for (const seg of prepared.slice(1)) {
    const stripped = stripMatchingClef(seg.gabc, clef);
    const piece = applyPrefix(stripped, seg.prefix);
    acc = seg.attach === "inline" ? glueInline(acc, piece) : glueLine(acc, piece);
  }
  return ensureFinalBar(acc);
}

/**
 * First half + second half of a short-responsory response, with `+` on the
 * single bar that divides them in the printed books.
 */
export function joinResponseHalves(
  first: string | undefined,
  second: string | undefined,
): string {
  const a = first?.trim() ? notationBody(first) : "";
  const b = second?.trim() ? notationBody(second) : "";
  if (!a) return b;
  if (!b) return a;
  const { clef, body } = splitClef(a);
  const head = stripTrailingBar(body);
  const tail = stripMatchingClef(b, clef);
  const joined = `${head} +(:) ${tail}`;
  return clef ? `${clef} ${joined}` : joined;
}

/** Versicle ending on a double bar, then `+` and the repeated second half. */
export function joinVerseWithRepeat(
  verse: string | undefined,
  second: string | undefined,
): string {
  const a = verse?.trim() ? notationBody(verse) : "";
  const b = second?.trim() ? notationBody(second) : "";
  if (!a) return b;
  if (!b) return a;
  const { clef, body } = splitClef(a);
  const head = ensureDoubleBar(body);
  const tail = stripMatchingClef(b, clef);
  const joined = `${head} + ${tail}`;
  return clef ? `${clef} ${joined}` : joined;
}

/**
 * Gloria Patri, then the full response (not a cue ℟.). The ℟. special is
 * applied to the response so it sits after the doxology the way the books
 * place the cue.
 */
export function joinGloriaWithResponse(
  gloria: string | undefined,
  response: string,
): string {
  const g = gloria?.trim() ? notationBody(gloria) : "";
  const r = response.trim() ? notationBody(response) : "";
  if (!g) return "";
  if (!r) return g;
  const { clef, body } = splitClef(g);
  const head = ensureDoubleBar(body);
  const resp = applyPrefix(stripMatchingClef(r, clef), "R");
  const joined = `${head} ${resp}`;
  return clef ? `${clef} ${joined}` : joined;
}
