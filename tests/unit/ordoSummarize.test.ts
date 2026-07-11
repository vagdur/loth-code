import { beforeAll, describe, expect, test } from "vitest";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { DataRepository } from "../../src/data/repository.js";
import { liturgicalYearRange, ordoContext, summarizeOrdoDay } from "../../src/ordo/index.js";
import { dataRoot } from "../helpers/paths.js";

let repo: DataRepository;
const ctx = ordoContext("stockholm");

beforeAll(async () => {
  const registry = await SanctoralCalendarRegistry.load(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await DataRepository.load(dataRoot, "sv");
});

describe("summarizeOrdoDay (stockholm)", () => {
  test("2026-07-11 St Benedict feast with Swedish headline and hour summaries", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 11), ctx, repo);

    expect(summary.headline).toBe(
      "11 juli. S:t Benedictus av Nursia, abbot, Europas skyddspatron. Fest.",
    );

    const lauds = summary.hours.find((h) => h.key === "lauds");
    expect(lauds).toBeDefined();
    expect(lauds!.prose).toContain("från propriet");
    expect(lauds!.prose).toContain("antifon till Benedictus");
    expect(lauds!.prose).toContain("commune");

    const compline = summary.hours.find((h) => h.key === "compline");
    expect(compline!.prose).toBe("Kompletorium för lördagen.");

    const oor = summary.hours.find((h) => h.key === "officeOfReadings");
    expect(oor!.prose).toContain("Te Deum");

    const firstVespers = summary.hours.find((h) => h.key === "firstVespers");
    expect(firstVespers).toBeDefined();

    const melodyOptions = summary.hours.some((h) => h.prose.includes("melodi"));
    expect(melodyOptions).toBe(false);
  });

  test("liturgical year 2025/2026 spans Advent 2025 through Christ the King 2026", () => {
    const range = liturgicalYearRange(2026, "stockholm");
    expect(range.from.getUTCFullYear()).toBe(2025);
    expect(range.from.getUTCMonth()).toBe(10);
    expect(range.to.getUTCFullYear()).toBe(2026);
    expect(range.to.getUTCMonth()).toBe(10);
  });
});
