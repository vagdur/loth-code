/**
 * office-spec §7 — Sunday gospel-canticle antiphons may vary by lectionary
 * Year A/B/C (editio typica altera). Cycle field precedes the plain field.
 */

import { describe, expect, test } from "vitest";
import { addDays, firstSundayOfAdvent } from "../../src/calendar/computus.js";
import { getSundayCycle } from "../../src/calendar/liturgicalYear.js";
import { buildLauds } from "../../src/hours/buildLauds.js";
import { buildVespers } from "../../src/hours/buildVespers.js";
import type { Celebration, LiturgicalDay } from "../../src/types/calendar.js";
import type { FallbackChain, SlotSourceDirect } from "../../src/types/hours.js";

function makeDay(
  celebration: Celebration,
  overrides: Partial<LiturgicalDay> = {},
): LiturgicalDay {
  return {
    date: new Date("2025-11-30T00:00:00Z"),
    season: "advent",
    psalterWeek: 1,
    psalterDay: "Sunday",
    readingYear: "II",
    sundayCycle: "A",
    ordinaryTimeWeek: 0,
    celebration,
    evening: { hasFirstVespers: false },
    saturdayBvmPermitted: false,
    ...overrides,
  };
}

const sunday: Celebration = {
  type: "sunday",
  source: "seasonal",
  seasonalKey: "advent_w1_sun",
  applicableCommons: [],
  memoriaFullySuppressed: false,
  memoriaReducedToOptional: false,
  allowMemoriaAddendum: false,
  isTriduum: false,
};

const defaultContext = {
  daytimeHoursSaid: ["sext"] as ("terce" | "sext" | "none")[],
  oorIsFirstHour: true,
  laudsFollowsOorDirectly: false,
  oorSaidAtNight: false,
  complineFollows: "after_second_vespers" as const,
  calendarId: "general",
};

describe("gospel canticle antiphon sunday cycle", () => {
  test("buildLauds chains benedictusAntiphonYr* ahead of plain", () => {
    const day = makeDay(sunday, { sundayCycle: "B" });
    const src = buildLauds(day, defaultContext).benedictusAntiphonRef as FallbackChain;
    expect(src.sources[0]).toMatchObject({
      kind: "seasonal",
      key: "advent_w1_sun",
      field: "lauds.benedictusAntiphonYrB",
    });
    expect(src.sources[1]).toMatchObject({
      kind: "seasonal",
      field: "lauds.benedictusAntiphon",
    });
  });

  test("buildVespers second Vespers chains magnificatAntiphonYr*", () => {
    const day = makeDay(sunday, { sundayCycle: "C" });
    const src = buildVespers(day, false).magnificatAntiphonRef as FallbackChain;
    expect(src.sources[0]).toMatchObject({
      kind: "seasonal",
      field: "vespers.magnificatAntiphonYrC",
    });
    expect(src.sources[1]).toMatchObject({
      kind: "seasonal",
      field: "vespers.magnificatAntiphon",
    });
  });

  test("buildVespers Sunday First Vespers chains cycle field on firstVespers", () => {
    const saturday = makeDay(
      {
        type: "ordinary_ferial",
        source: "seasonal",
        seasonalKey: "ot_w34_sat",
        applicableCommons: [],
        memoriaFullySuppressed: false,
        memoriaReducedToOptional: false,
        allowMemoriaAddendum: false,
        isTriduum: false,
      },
      {
        // Mid-year Saturday: eve and Sunday share the same cycle.
        date: new Date("2025-10-11T00:00:00Z"),
        psalterDay: "Saturday",
        psalterWeek: 4,
        sundayCycle: "C",
        evening: { hasFirstVespers: true, firstVespersCelebration: sunday },
      },
    );
    const src = buildVespers(
      { ...saturday, celebration: sunday },
      true,
    ).magnificatAntiphonRef as FallbackChain;
    const seasonal = src.sources.filter(
      (s): s is SlotSourceDirect => s.kind === "seasonal",
    );
    expect(seasonal.map((s) => s.field)).toEqual([
      "firstVespers.magnificatAntiphonYrC",
      "firstVespers.magnificatAntiphon",
    ]);
  });

  test("Advent eve First Vespers uses tomorrow's sunday cycle, not the ending year", () => {
    // Advent 2025 begins Year A; the Saturday before is still Year C.
    const advent = firstSundayOfAdvent(2025);
    const eve = addDays(advent, -1);
    expect(getSundayCycle(eve)).toBe("C");
    expect(getSundayCycle(advent)).toBe("A");

    const saturday = makeDay(
      {
        type: "ordinary_ferial",
        source: "seasonal",
        seasonalKey: "ot_w34_sat",
        applicableCommons: [],
        memoriaFullySuppressed: false,
        memoriaReducedToOptional: false,
        allowMemoriaAddendum: false,
        isTriduum: false,
      },
      {
        date: eve,
        season: "ordinary_time",
        psalterDay: "Saturday",
        psalterWeek: 4,
        sundayCycle: getSundayCycle(eve),
        evening: { hasFirstVespers: true, firstVespersCelebration: sunday },
      },
    );
    const vespers = buildVespers({ ...saturday, celebration: sunday }, true);
    const src = vespers.magnificatAntiphonRef as FallbackChain;
    expect(src.sources[0]).toMatchObject({
      kind: "seasonal",
      field: "firstVespers.magnificatAntiphonYrA",
    });
    expect(vespers.liturgicalDay.sundayCycle).toBe("A");
  });
});
