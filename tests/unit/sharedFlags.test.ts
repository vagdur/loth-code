/**
 * office-spec §3.2 (Alleluia in introductory verse), §7 (Eastertide Alleluia on antiphons)
 * — flags consumed by assemblers.
 */

import { describe, expect, test } from "vitest";
import type { LiturgicalDay } from "../../src/types/calendar.js";
import { makeFlags } from "../../src/hours/shared.js";

function dayWithSeason(season: LiturgicalDay["season"]): LiturgicalDay {
  return {
    date: new Date("2026-05-10T00:00:00Z"),
    season,
    psalterWeek: 2,
    psalterDay: "Sunday",
    readingYear: "I",
    ordinaryTimeWeek: 0,
    celebration: {
      type: "sunday",
      source: "seasonal",
      seasonalKey: "easter_w6_sun",
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

describe("makeFlags", () => {
  test("office-spec §7 — Eastertide: Alleluia in antiphons", () => {
    const f = makeFlags(dayWithSeason("eastertide"), false);
    expect(f.alleluiaInAntiphons).toBe(true);
  });

  test("office-spec §3.2 — Lent: no Alleluia in introductory verse", () => {
    const f = makeFlags(dayWithSeason("lent"), false);
    expect(f.alleluiaInIntroVerse).toBe(false);
    expect(f.alleluiaInAntiphons).toBe(false);
  });

  test("Holy Week: no Alleluia in introductory verse", () => {
    const f = makeFlags(dayWithSeason("holy_week"), false);
    expect(f.alleluiaInIntroVerse).toBe(false);
  });

  test("Easter Triduum: no Alleluia in introductory verse", () => {
    const f = makeFlags(dayWithSeason("easter_triduum"), false);
    expect(f.alleluiaInIntroVerse).toBe(false);
  });

  test("Ordinary Time: Alleluia in introductory verse", () => {
    const d = dayWithSeason("ordinary_time");
    d.celebration = {
      type: "ordinary_ferial",
      source: "seasonal",
      applicableCommons: [],
      memoriaFullySuppressed: false,
      memoriaReducedToOptional: false,
      allowMemoriaAddendum: false,
      isTriduum: false,
    };
    const f = makeFlags(d, false);
    expect(f.alleluiaInIntroVerse).toBe(true);
    expect(f.alleluiaInAntiphons).toBe(false);
  });

  test("passes Te Deum through unchanged", () => {
    expect(makeFlags(dayWithSeason("ordinary_time"), true).teDeum).toBe(true);
    expect(makeFlags(dayWithSeason("ordinary_time"), false).teDeum).toBe(false);
  });
});
