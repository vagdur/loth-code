/**
 * The season-wide "under dagen" booklets route to the coarse
 * daytime_<season>[_<weekday>] keys. This pins the routing against the real
 * section labels.
 */

import { describe, expect, test } from "vitest";
// @ts-expect-error - plain .mjs script, no type declarations
import { mapSeasonDaytime } from "../../scripts/map-melodies.mjs";

interface Mel { id: string; sectionLabel: string; variantLabel?: string }
const mel = (id: string, sectionLabel: string): Mel => ({ id, sectionLabel });

function slots(base: string, melodies: Mel[]) {
  const res = mapSeasonDaytime(base, melodies) as {
    actions: { occurrenceId: string; targets: { file: string; slot: string }[]; note?: string }[];
    unmapped: { mel: Mel; reason: string }[];
  } | null;
  return res;
}

describe("mapSeasonDaytime", () => {
  test("returns null for a non-booklet base", () => {
    expect(mapSeasonDaytime("M1-V", [])).toBeNull();
  });

  test("Advent: per-hour antiphon → daytime_advent; stacked shared hymn skipped", () => {
    const res = slots("Adv-UD", [
      mel("h", "Hymn"),
      mel("t", "Ters antifon"),
      mel("s", "Sext antifon"),
      mel("n", "Non antifon"),
    ])!;
    const flat = res.actions.flatMap((a) => a.targets.map((t) => `${a.occurrenceId}:${t.slot}`));
    expect(flat).toEqual([
      "t:terce.antiphons[0]",
      "s:sext.antiphons[0]",
      "n:none.antiphons[0]",
    ]);
    expect(res.actions.every((a) => a.targets.every((t) => t.file === "proper_of_seasons/daytime_advent.yaml"))).toBe(true);
    // The shared hymn is a stacked Ters/Sext/Non score; the per-hour split of
    // Hymner-under-dagen covers those slots, so it stays unmapped.
    expect(res.unmapped).toHaveLength(1);
    expect(res.unmapped[0].mel.id).toBe("h");
    expect(res.unmapped[0].reason).toMatch(/Hymner-under-dagen/);
  });

  test("Lent: (Hymn, Antifon) pairs advance the hour → daytime_lent", () => {
    const res = slots("Fastan_I-UD", [
      mel("h1", "Hymn"), mel("a1", "Antifon"),
      mel("h2", "Hymn"), mel("a2", "Antifon"),
      mel("h3", "Hymn"), mel("a3", "Antifon"),
    ])!;
    const flat = res.actions.map((a) => `${a.occurrenceId}:${a.targets[0].slot}`);
    expect(flat).toEqual([
      "h1:terce.hymn", "a1:terce.antiphons[0]",
      "h2:sext.hymn", "a2:sext.antiphons[0]",
      "h3:none.hymn", "a3:none.antiphons[0]",
    ]);
  });

  test("Eastertide: per-weekday antiphon across all three hours; eller/repeat = alternative", () => {
    const res = slots("Antifoner-under-dagen-PT", [
      mel("sun", "Söndag"),
      mel("sun-alt", "eller :"),
      mel("mon", "Måndag"),
      mel("mon-alt", "Måndag"),   // repeated weekday = tone alternative
      mel("tue", "Tisdag"),
    ])!;
    const sun = res.actions.filter((a) => a.occurrenceId === "sun");
    expect(sun.map((a) => a.targets[0].slot)).toEqual([
      "terce.antiphons[0]", "sext.antiphons[0]", "none.antiphons[0]",
    ]);
    expect(sun[0].targets[0].file).toBe("proper_of_seasons/daytime_eastertide_sunday.yaml");
    // The "eller:" row becomes an alternative (note: eller) on the prior slot.
    const alt = res.actions.find((a) => a.occurrenceId === "sun-alt");
    expect(alt?.note).toBe("eller");
    // A repeated "Måndag" is likewise folded in as an alternative, not a new day.
    const monAlt = res.actions.find((a) => a.occurrenceId === "mon-alt");
    expect(monAlt?.note).toBe("eller");
    expect(res.actions.find((a) => a.occurrenceId === "tue")?.targets[0].file)
      .toBe("proper_of_seasons/daytime_eastertide_tuesday.yaml");
  });
});
