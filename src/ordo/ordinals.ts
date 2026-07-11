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

export function ordinalWeek(n: number): string {
  if (n >= 1 && n <= ORDINAL_WEEKS.length) return ORDINAL_WEEKS[n - 1]!;
  return `${n}:e`;
}
