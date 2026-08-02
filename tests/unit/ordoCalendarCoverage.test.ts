import fs from "fs/promises";
import path from "path";
import { beforeAll, describe, expect, test } from "vitest";
import yaml from "js-yaml";
import { utcDate } from "../../src/calendar/computus.js";
import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import {
  getSaintsOnDate,
  initSanctoralRegistry,
} from "../../src/calendar/saints.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";
import { dataRoot, defaultLocale, repoRoot } from "../helpers/paths.js";

describe("Ordo calendar coverage", () => {
  let expected: { entries: Array<{ id: string; layer?: string; rank?: string; fixed_date?: { month: number; day: number } }> };

  beforeAll(async () => {
    const raw = await fs.readFile(
      path.join(repoRoot, "data", "ordo", "expected-calendar.yaml"),
      "utf-8",
    );
    expected = yaml.load(raw) as typeof expected;
  });

  test("expected manifest matches merged stockholm registry", async () => {
    const registry = await loadSanctoralRegistry(dataRoot, "sv");
    const general = registry.getMergedEntries("general");
    const stockholm = registry.getMergedEntries("stockholm");
    const generalById = new Map(general.map((e) => [e.id, e]));
    const stockholmById = new Map(stockholm.map((e) => [e.id, e]));
    const stockholmOnly = new Set(
      stockholm.filter((e) => !generalById.has(e.id)).map((e) => e.id),
    );

    for (const exp of expected.entries) {
      if (exp.layer === "stockholm" && !("kind" in exp)) {
        expect(stockholmOnly.has(exp.id)).toBe(true);
      }
      if (exp.layer === "general" && exp.fixed_date) {
        expect(generalById.has(exp.id)).toBe(true);
      }
    }

    expect(stockholmById.get("st_birgitta")?.rank).toBe("optional_memoria");
  });
});

describe("SanctoralCalendarRegistry", () => {
  let registry: SanctoralCalendarRegistry;

  beforeAll(async () => {
    registry = await loadSanctoralRegistry(dataRoot, defaultLocale);
    initSanctoralRegistry(registry);
  });

  test("general calendar has full GRC sanctoral coverage", () => {
    const entries = registry.getMergedEntries("general");
    expect(entries.length).toBeGreaterThanOrEqual(200);
    expect(entries.map((e) => e.id)).toContain("annunciation");
    expect(entries.map((e) => e.id)).toContain("francis_xavier");
  });

  test("stockholm merge includes Nordic additions and Birgitta adjustments", () => {
    const general = registry.getMergedEntries("general");
    const entries = registry.getMergedEntries("stockholm");
    const stockholmOnly = entries.filter(
      (e) => !general.some((g) => g.id === e.id),
    );
    expect(stockholmOnly.length).toBeGreaterThanOrEqual(15);
    expect(entries.map((e) => e.id)).toContain("st_henrik");
    expect(entries.map((e) => e.id)).toContain("st_erik");
    expect(entries.map((e) => e.id)).toContain("st_birgitta_patron");
    expect(entries.map((e) => e.id)).toContain("ansgar");
    expect(entries.map((e) => e.id)).toContain("sigfrid_of_vaxjo");

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

  test("st_andrew remains in registry on First Sunday of Advent 2025 (suppressed by ranking, not absent)", () => {
    const nov30 = utcDate(2025, 11, 30);
    expect(getSaintsOnDate(nov30, "stockholm").map((s) => s.saintId)).toContain(
      "andrew_apostle",
    );
  });
});
