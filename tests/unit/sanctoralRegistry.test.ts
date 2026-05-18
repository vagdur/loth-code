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

  test("general calendar is non-empty", () => {
    expect(registry.getMergedEntries("general")).not.toHaveLength(0);
  });

  test("stockholm merge includes local additions and Birgitta adjustments", () => {
    const entries = registry.getMergedEntries("stockholm");
    expect(entries).toHaveLength(7);
    expect(entries.map((e) => e.id)).toContain("st_henrik");
    expect(entries.map((e) => e.id)).toContain("st_erik");
    expect(entries.map((e) => e.id)).toContain("st_birgitta_patron");

    const birgittaJul = entries.find((e) => e.id === "st_birgitta");
    expect(birgittaJul?.rank).toBe("optional_memoria");
    expect(birgittaJul?.name).toMatch(/Heavenly birthday/i);
  });

  test("unknown calendar id throws", () => {
    expect(() => registry.getMergedEntries("unknown")).toThrow(
      /Unknown sanctoral calendar id/,
    );
  });

  test("general seasonal observance uses universal defaults", () => {
    expect(registry.getSeasonalObservance("general")).toEqual({
      epiphany: "fixed_jan_6",
      corpusChristi: "thursday_after_trinity",
      ascension: "thursday",
    });
  });

  test("stockholm seasonal observance merges Corpus Christi to Sunday", () => {
    const policy = registry.getSeasonalObservance("stockholm");
    expect(policy.epiphany).toBe("fixed_jan_6");
    expect(policy.corpusChristi).toBe("second_sunday_after_pentecost");
    expect(policy.ascension).toBe("thursday");
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

  test("St. Birgitta: feast 23 Jul in general, memoria in stockholm; solemnity 7 Oct in stockholm only", () => {
    const jul23 = utcDate(2026, 7, 23);
    const generalJul = getSaintsOnDate(jul23, "general");
    const stockholmJul = getSaintsOnDate(jul23, "stockholm");
    expect(generalJul.find((s) => s.saintId === "st_birgitta")?.rank).toBe("feast");
    expect(stockholmJul.find((s) => s.saintId === "st_birgitta")?.rank).toBe(
      "optional_memoria",
    );

    const oct7 = utcDate(2026, 10, 7);
    expect(getSaintsOnDate(oct7, "stockholm").map((s) => s.saintId)).toContain(
      "st_birgitta_patron",
    );
    expect(getSaintsOnDate(oct7, "general").map((s) => s.saintId)).not.toContain(
      "st_birgitta_patron",
    );
  });
});
