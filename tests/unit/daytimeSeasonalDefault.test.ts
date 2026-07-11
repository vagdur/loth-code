/**
 * Daytime prayer consults season-scoped defaults after the day's own proper
 * and before the psalter: weekday-specific first (Eastertide varies by
 * weekday), then weekday-invariant (Advent/Lent are the same every day).
 */

import { describe, expect, test } from "vitest";
import { buildDaytimePrayer } from "../../src/hours/buildDaytimePrayer.js";
import { seasonDaytimeKeys } from "../../src/hours/resolver.js";
import type { LiturgicalDay, Season } from "../../src/types/calendar.js";
import type { FallbackChain, SlotSource, SlotSourceDirect } from "../../src/types/hours.js";

function flatten(src: SlotSource | undefined): SlotSourceDirect[] {
  if (!src) return [];
  if (src.kind === "fallback_chain") return (src as FallbackChain).sources as SlotSourceDirect[];
  return [src as SlotSourceDirect];
}

function seasonalDay(season: Season, seasonalKey: string): LiturgicalDay {
  return {
    date: new Date("2026-04-13T00:00:00Z"),
    season,
    psalterWeek: 2,
    psalterDay: "Monday",
    readingYear: "II",
    sundayCycle: "A",
    ordinaryTimeWeek: 0,
    celebration: {
      type: "privileged_ferial",
      source: "seasonal",
      seasonalKey,
      applicableCommons: [],
      memoriaFullySuppressed: false,
      memoriaReducedToOptional: false,
      allowMemoriaAddendum: false,
      isTriduum: false,
    },
    evening: { hasFirstVespers: false },
    saturdayBvmPermitted: false,
  };
}

describe("seasonDaytimeKeys", () => {
  test("weekday-specific before weekday-invariant", () => {
    expect(seasonDaytimeKeys("eastertide", "Monday")).toEqual([
      "daytime_eastertide_monday",
      "daytime_eastertide",
    ]);
    expect(seasonDaytimeKeys("advent", "Tuesday")).toEqual([
      "daytime_advent_tuesday",
      "daytime_advent",
    ]);
  });
});

describe("buildDaytimePrayer season-default fallback", () => {
  test("antiphon chain: day proper → season default → (no psalter terminal)", () => {
    const day = seasonalDay("eastertide", "easter_w2_mon");
    const hour = buildDaytimePrayer(day, "sext", true);
    const keys = flatten(hour.properAntiphonsRef).map((s) =>
      s.kind === "seasonal" ? s.key : s.kind,
    );
    expect(keys).toEqual([
      "easter_w2_mon",             // the day's own proper
      "daytime_eastertide_monday", // weekday-specific season default
      "daytime_eastertide",        // weekday-invariant season default
    ]);
    // Antiphons never fall through to the psalter (which has no antiphons field);
    // absence leaves the psalmody's own antiphons in place.
    expect(flatten(hour.properAntiphonsRef).some((s) => s.kind === "psalter")).toBe(false);
  });

  test("hymn chain: day proper → season default → psalter terminal", () => {
    const day = seasonalDay("advent", "advent_w2_mon");
    const hour = buildDaytimePrayer(day, "terce", true);
    const flat = flatten(hour.hymnRef);
    expect(flat.map((s) => (s.kind === "seasonal" ? s.key : s.kind))).toEqual([
      "advent_w2_mon",
      "daytime_advent_monday",
      "daytime_advent",
      "psalter",
    ]);
    expect(flat.every((s) => s.field === "terce.hymn")).toBe(true);
  });

  test("ordinary time still resolves (coarse keys just never match)", () => {
    const day = seasonalDay("ordinary_time", "ot_w2_mon");
    const hour = buildDaytimePrayer(day, "none", true);
    // No crash; hymn still ends at the psalter.
    expect(flatten(hour.hymnRef).at(-1)).toMatchObject({ kind: "psalter", field: "none.hymn" });
  });

  test("memoria §5.4 — short reading, antiphons, and prayer stay ferial", () => {
    const day: LiturgicalDay = {
      date: new Date("2026-01-20T00:00:00Z"),
      season: "ordinary_time",
      psalterWeek: 1,
      psalterDay: "Tuesday",
      readingYear: "II",
      sundayCycle: "A",
      ordinaryTimeWeek: 2,
      celebration: {
        type: "optional_memoria",
        source: "saint",
        saintId: "fabian_pope",
        applicableCommons: ["martyrs", "pastors"],
        memoriaFullySuppressed: false,
        memoriaReducedToOptional: false,
        allowMemoriaAddendum: false,
        isTriduum: false,
      },
      evening: { hasFirstVespers: false },
      saturdayBvmPermitted: false,
    };
    const hour = buildDaytimePrayer(day, "sext", true);
    expect(flatten(hour.shortReadingRef)).toEqual([
      { kind: "psalter", week: 1, day: "Tuesday", field: "sext.shortReading" },
    ]);
    expect(flatten(hour.properAntiphonsRef).every((s) => s.kind !== "saint")).toBe(true);
    expect(flatten(hour.concludingPrayerRef)).toEqual([
      { kind: "psalter", week: 1, day: "Tuesday", field: "sext.concludingPrayer" },
    ]);
  });
});
