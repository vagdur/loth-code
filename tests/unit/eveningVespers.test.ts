/**
 * office-spec §5.1 / GILH n. 61 — when First Vespers of tomorrow outranks
 * today's Vespers, eveningVespers() selects that First Vespers.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { defaultContext, resolveDay } from "../../src/calendar/index.js";
import { utcDate } from "../../src/calendar/computus.js";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { buildDay, eveningVespers } from "../../src/hours/index.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";
import { loadSampleRepo } from "../helpers/buildSampleDay.js";

const cal = "general";

describe("eveningVespers", () => {
  beforeAll(() => ensureSanctoralCalendar());

  test("Saturday memoria yields First Vespers of Sunday, not memorial Vespers", () => {
    // 1 Aug 2026: St Alphonsus (obligatory memoria) on Saturday before OT Sunday 18
    const lit = resolveDay(utcDate(2026, 8, 1), cal);
    expect(lit.celebration.type).toBe("obligatory_memoria");
    expect(lit.celebration.saintId).toBe("alphonsus_liguori");
    expect(lit.evening.hasFirstVespers).toBe(true);
    expect(lit.evening.firstVespersCelebration?.type).toBe("sunday");

    const day = buildDay(lit, defaultContext());
    expect(day.firstVespers).toBeDefined();
    expect(day.vespers.isFirstVespers).toBe(false);
    expect(day.vespers.liturgicalDay.celebration.saintId).toBe("alphonsus_liguori");

    const evening = eveningVespers(day);
    expect(evening).toBe(day.firstVespers);
    expect(evening.isFirstVespers).toBe(true);
    expect(evening.liturgicalDay.celebration.type).toBe("sunday");
  });

  test("assembled evening Vespers on that Saturday is First Vespers of Sunday", async () => {
    const lit = resolveDay(utcDate(2026, 8, 1), cal);
    const day = buildDay(lit, defaultContext());
    const repo = await loadSampleRepo("en");
    const text = new PlainTextAssembler().assembleVespers(eveningVespers(day), repo);
    const labels = repo.getAssemblerLabels();
    expect(text).toContain(labels.hours.firstVespers);
    expect(text).not.toMatch(/Alphonsus/i);
  });

  test("Sunday evening uses Second Vespers", () => {
    const lit = resolveDay(utcDate(2026, 8, 2), cal);
    expect(lit.celebration.type).toBe("sunday");
    expect(lit.evening.hasFirstVespers).toBe(false);

    const day = buildDay(lit, defaultContext());
    expect(day.firstVespers).toBeUndefined();
    expect(eveningVespers(day)).toBe(day.vespers);
    expect(eveningVespers(day).isFirstVespers).toBe(false);
  });
});
