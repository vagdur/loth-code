/**
 * office-spec §5.4 — the invitatory antiphon comes from the saint's office
 * when proper, otherwise from the Common or the current ferial day.
 */

import { describe, expect, test } from "vitest";
import { buildInvitatory } from "../../src/hours/buildInvitatory.js";
import type { Celebration, LiturgicalDay } from "../../src/types/calendar.js";
import type { FallbackChain } from "../../src/types/hours.js";

function makeDay(celebration: Celebration): LiturgicalDay {
  return {
    date: new Date("2026-10-06T00:00:00Z"),
    season: "ordinary_time",
    psalterWeek: 3,
    psalterDay: "Tuesday",
    readingYear: "I",
    sundayCycle: "A",
    ordinaryTimeWeek: 27,
    celebration,
    evening: { hasFirstVespers: false },
    saturdayBvmPermitted: false,
  };
}

const baseFlags = {
  memoriaFullySuppressed: false,
  memoriaReducedToOptional: false,
  allowMemoriaAddendum: false,
  isTriduum: false,
};

describe("buildInvitatory antiphon chain", () => {
  test("memoria: saint → commons → psalter, ad libitum after the proper", () => {
    const day = makeDay({
      type: "obligatory_memoria",
      source: "saint",
      saintId: "st_x",
      applicableCommons: ["martyrs", "pastors"],
      ...baseFlags,
    });
    const src = buildInvitatory(day).antiphonRef as FallbackChain;
    expect(src.kind).toBe("fallback_chain");
    expect(src.adLibFrom).toBe(1);
    expect(src.sources.map((s) => s.kind)).toEqual([
      "saint", "common", "common", "psalter",
    ]);
    expect(src.sources[0]).toMatchObject({ id: "st_x", field: "invitatoryAntiphon" });
  });

  test("saint solemnity: strict saint → commons → psalter", () => {
    const day = makeDay({
      type: "solemnity",
      source: "saint",
      saintId: "st_x",
      applicableCommons: ["apostles"],
      ...baseFlags,
    });
    const src = buildInvitatory(day).antiphonRef as FallbackChain;
    expect(src.kind).toBe("fallback_chain");
    expect(src.adLibFrom).toBeUndefined();
    expect(src.sources[0]!.kind).toBe("saint");
  });

  test("fully suppressed memoria: no saint head", () => {
    const day = makeDay({
      type: "sunday",
      source: "seasonal",
      seasonalKey: "ot_w27_sun",
      applicableCommons: [],
      ...baseFlags,
      memoriaFullySuppressed: true,
    });
    const src = buildInvitatory(day).antiphonRef as FallbackChain;
    expect(src.sources.map((s) => s.kind)).toEqual(["seasonal", "psalter"]);
  });

  test("seasonal day: seasonal → psalter (unchanged)", () => {
    const day = makeDay({
      type: "privileged_ferial",
      source: "seasonal",
      seasonalKey: "advent_w1_tue",
      applicableCommons: [],
      ...baseFlags,
    });
    const src = buildInvitatory(day).antiphonRef as FallbackChain;
    expect(src.sources.map((s) => s.kind)).toEqual(["seasonal", "psalter"]);
  });

  test("plain ferial without seasonal key: psalter only", () => {
    const day = makeDay({
      type: "ordinary_ferial",
      source: "seasonal",
      applicableCommons: [],
      ...baseFlags,
    });
    const src = buildInvitatory(day).antiphonRef;
    expect(src.kind).toBe("psalter");
  });
});
