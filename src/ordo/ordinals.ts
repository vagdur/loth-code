/**
 * Ordinal words for week numbers, as the Ordo prose templates want them
 * ("{week} söndagen i Advent"). Swedish is the built-in default, since that is
 * the corpus this was written for; a locale supplies its own through
 * `labels.ordo.ordinals`.
 */
export const ORDINAL_WEEKS = [
  "första", "andra", "tredje", "fjärde", "femte", "sjätte", "sjunde", "åttonde",
  "nionde", "tionde", "elfte", "tolfte", "trettonde", "fjortonde", "femtonde",
  "sextonde", "sjuttonde", "artonde", "nittonde", "tjugonde", "tjugoförsta",
  "tjugoandra", "tjugotredje", "tjugofjärde", "tjugofemte", "tjugosjette",
  "tjugosjunde", "tjugoåttonde", "tjugonionde", "trettionde", "trettioförsta",
  "trettioandra", "trettiotredje", "trettiofjärde",
];

export function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`);
}

/** Ordinal source: the locale's own words, falling back to the Swedish ones. */
export interface OrdinalLabels {
  ordinals?: string[];
  /** Suffix for numbers past the word list, e.g. ":e" (sv) or "th" (en). */
  ordinalSuffix?: string;
}

export function ordinalWeek(n: number, labels?: OrdinalLabels): string {
  const words = labels?.ordinals ?? ORDINAL_WEEKS;
  if (n >= 1 && n <= words.length) return words[n - 1]!;
  return `${n}${labels?.ordinalSuffix ?? ":e"}`;
}
