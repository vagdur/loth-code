import { beforeAll, describe, expect, test } from "vitest";
import { utcDate } from "../../src/calendar/computus.js";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import {
  getSaintsOnDate,
  initSanctoralRegistry,
} from "../../src/calendar/saints.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";
import { dataDir } from "../helpers/paths.js";

describe("SanctoralCalendarRegistry", () => {
  let registry: SanctoralCalendarRegistry;

  beforeAll(async () => {
    registry = await SanctoralCalendarRegistry.load(dataDir);
    initSanctoralRegistry(registry);
  });

  test("general calendar has three entries", () => {
    expect(registry.getMergedEntries("general")).toHaveLength(3);
  });

  test("stockholm merge includes local additions", () => {
    const entries = registry.getMergedEntries("stockholm");
    expect(entries).toHaveLength(5);
    expect(entries.map((e) => e.id)).toContain("st_henrik");
    expect(entries.map((e) => e.id)).toContain("st_erik");
  });

  test("unknown calendar id throws", () => {
    expect(() => registry.getMergedEntries("unknown")).toThrow(
      /Unknown sanctoral calendar id/,
    );
  });
});

describe("getSaintsOnDate with calendarId", () => {
  beforeAll(() => ensureSanctoralCalendar());

  test("st_henrik on 19 Jan in stockholm, not in general", () => {
    const date = utcDate(2026, 1, 19);
    const stockholm = getSaintsOnDate(date, "stockholm");
    const general = getSaintsOnDate(date, "general");
    expect(stockholm.map((s) => s.saintId)).toContain("st_henrik");
    expect(general.map((s) => s.saintId)).not.toContain("st_henrik");
  });
});
