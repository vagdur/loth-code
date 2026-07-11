/**
 * Daytime psalmody choice: "<hour>.psalmody" overrides which daytime hour
 * uses current vs. complementary psalmody in buildDay.
 */

import { describe, expect, test } from "vitest";
import { defaultContext } from "../../src/calendar/index.js";
import { buildDay } from "../../src/hours/index.js";
import type { AbstractDaytimePrayer, SlotSource } from "../../src/types/hours.js";
import type { LiturgicalDay } from "../../src/types/calendar.js";

function makeDay(): LiturgicalDay {
  return {
    date: new Date("2026-10-06T00:00:00Z"),
    season: "ordinary_time",
    psalterWeek: 3,
    psalterDay: "Tuesday",
    readingYear: "I",
    sundayCycle: "A",
    ordinaryTimeWeek: 27,
    celebration: {
      type: "ordinary_ferial",
      source: "seasonal",
      seasonalKey: "ot_w27_tue",
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

function usesComplementary(hour: AbstractDaytimePrayer | undefined): boolean {
  const src = hour?.psalmSlots[0]?.assignmentRef as SlotSource | undefined;
  return src?.kind === "complementary";
}

describe("buildDay daytime psalmody choice", () => {
  const day = makeDay();

  test("default: the single hour said uses current psalmody", () => {
    const ctx = { ...defaultContext(), daytimeHoursSaid: ["sext" as const] };
    const abs = buildDay(day, ctx);
    expect(usesComplementary(abs.sext)).toBe(false);
  });

  test("'complementary' choice on the single hour said", () => {
    const ctx = { ...defaultContext(), daytimeHoursSaid: ["sext" as const] };
    const abs = buildDay(day, ctx, { "sext.psalmody": "complementary" });
    expect(usesComplementary(abs.sext)).toBe(true);
  });

  test("default with all three hours: sext is current, others complementary", () => {
    const ctx = {
      ...defaultContext(),
      daytimeHoursSaid: ["terce", "sext", "none"] as Array<"terce" | "sext" | "none">,
    };
    const abs = buildDay(day, ctx);
    expect(usesComplementary(abs.terce)).toBe(true);
    expect(usesComplementary(abs.sext)).toBe(false);
    expect(usesComplementary(abs.none)).toBe(true);
  });

  test("choices can move current psalmody to another hour", () => {
    const ctx = {
      ...defaultContext(),
      daytimeHoursSaid: ["terce", "sext", "none"] as Array<"terce" | "sext" | "none">,
    };
    const abs = buildDay(day, ctx, {
      "terce.psalmody": "current",
      "sext.psalmody": "complementary",
    });
    expect(usesComplementary(abs.terce)).toBe(false);
    expect(usesComplementary(abs.sext)).toBe(true);
    expect(usesComplementary(abs.none)).toBe(true);
  });

  test("a stale psalmody value falls back to the default", () => {
    const ctx = { ...defaultContext(), daytimeHoursSaid: ["sext" as const] };
    const abs = buildDay(day, ctx, { "sext.psalmody": "whatever" });
    expect(usesComplementary(abs.sext)).toBe(false);
  });
});
