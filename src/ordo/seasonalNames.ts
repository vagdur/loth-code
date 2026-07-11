/** Map a SeasonalDayKey (snake_case) to the camelCase key used in fixed_texts.yaml. */
function seasonalNameKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function lookupSeasonalName(
  key: string,
  names?: Record<string, string>,
): string | undefined {
  if (!names) return undefined;
  return names[key] ?? names[seasonalNameKey(key)];
}
