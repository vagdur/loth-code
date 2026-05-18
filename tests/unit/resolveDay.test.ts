/**
 * office-spec §4–§5 (day class), §5.1–5.2 (First Vespers), §5.6 (Saturday BVM),
 * §20 step 1 — resolveDay output for representative civil dates.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { resolveDay } from "../../src/calendar/index.js";
import { utcDate } from "../../src/calendar/computus.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";

const cal = "general";

describe("resolveDay", () => {
  beforeAll(() => ensureSanctoralCalendar());
  test("Eastertide Sunday is a Sunday celebration", () => {
    // office-spec §4 — Sunday in Eastertide
    const d = resolveDay(new Date("2026-05-10T12:00:00Z"), cal);
    expect(d.season).toBe("eastertide");
    expect(d.celebration.type).toBe("sunday");
    expect(d.celebration.source).toBe("seasonal");
    expect(d.celebration.seasonalKey).toMatch(/^easter_w/);
  });

  test("Saturday in Ordinary Time after Pentecost: optional BVM memoria permitted", () => {
    // office-spec §5.6 — Saturday in OT, ordinary ferial
    const d = resolveDay(new Date("2026-06-06T12:00:00Z"), cal);
    expect(d.psalterDay).toBe("Saturday");
    expect(d.season).toBe("ordinary_time");
    expect(d.celebration.type).toBe("ordinary_ferial");
    expect(d.saturdayBvmPermitted).toBe(true);
  });

  test("Saturday in Lent: privileged ferial, no Saturday BVM overlay", () => {
    // office-spec §5.5 — privileged season ferial
    const d = resolveDay(utcDate(2026, 3, 7), cal);
    expect(d.psalterDay).toBe("Saturday");
    expect(d.season).toBe("lent");
    expect(d.celebration.type).toBe("privileged_ferial");
    expect(d.saturdayBvmPermitted).toBe(false);
  });

  test("evening before Sunday has First Vespers of the Sunday", () => {
    // office-spec §5.1 — First Vespers on preceding evening
    const sat = resolveDay(new Date("2026-05-09T12:00:00Z"), cal);
    expect(sat.evening.hasFirstVespers).toBe(true);
    expect(sat.evening.firstVespersCelebration?.type).toBe("sunday");
  });

  test("Annunciation transferred onto civil date yields saint solemnity", () => {
    // 2024: 25 March falls in Holy Week; celebration moves to 8 April.
    const d = resolveDay(new Date("2024-04-08T12:00:00Z"), cal);
    expect(d.celebration.type).toBe("solemnity");
    expect(d.celebration.source).toBe("saint");
    expect(d.celebration.saintId).toBe("annunciation");
  });

  test("Immaculate Conception on 8 December is a saint solemnity", () => {
    const d = resolveDay(utcDate(2026, 12, 8), cal);
    expect(d.celebration.type).toBe("solemnity");
    expect(d.celebration.source).toBe("saint");
    expect(d.celebration.saintId).toBe("immaculate_conception");
  });
});
