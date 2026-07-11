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
  test("2026-01-04 Sunday after Christmas uses computed ordinal, not calendar date", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 4), ctx, repo);
    expect(summary.headline).toBe("4 januari. Andra söndagen efter jul.");
  });

  test("2025-01-04 Saturday in Christmas season uses weekday ferial title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 1, 4), ctx, repo);
    expect(summary.headline).toBe("4 januari. Lördag i jultiden.");
  });

  test("2025-12-25 Christmas solemnity uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 25), ctx, repo);
    expect(summary.headline).toBe("25 december. Juldagen. Högtid.");
  });

  test("2026-01-11 Baptism of the Lord uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 11), ctx, repo);
    expect(summary.headline).toBe("11 januari. Herrens dop. Högtid.");
  });

  test("2025-12-28 Holy Family uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 28), ctx, repo);
    expect(summary.headline).toBe("28 december. Den heliga familjen. Herrens högtid på söndag.");
  });

  test("2026-04-05 Easter Sunday uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 4, 5), ctx, repo);
    expect(summary.headline).toBe("5 april. Påskdagen. Triduum.");
  });

  test("2026-04-06 Easter Monday uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 4, 6), ctx, repo);
    expect(summary.headline).toBe("6 april. Annandag påsk. Högtid.");
  });

  test("2025-12-17 Advent dec 17-24 ferial uses same weekly title as other Advent weekdays", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 17), ctx, repo);
    expect(summary.headline).toBe("17 december. Onsdag i tredje veckan i advent.");
  });

  test("2025-12-22 Advent dec 17-24 ferial uses same weekly title as other Advent weekdays", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 22), ctx, repo);
    expect(summary.headline).toBe("22 december. Måndag i fjärde veckan i advent.");
  });

  test("2025-11-30 first Advent Sunday uses readable title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 11, 30), ctx, repo);
    expect(summary.headline).toBe("30 november. Första söndagen i Advent.");
  });

  test("2025-12-21 fourth Advent Sunday on dec 21 uses readable title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 21), ctx, repo);
    expect(summary.headline).toBe("21 december. Fjärde söndagen i Advent.");
  });

  test("2026-02-22 first Lent Sunday uses readable title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 2, 22), ctx, repo);
    expect(summary.headline).toBe("22 februari. Första söndagen i fastan.");
  });

  test("2026-01-18 first OT Sunday keeps numeric form without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 18), ctx, repo);
    expect(summary.headline).toBe("18 januari. 1:e söndagen under året.");
  });

  test("2025-12-29 Christmas octave ferial uses octave day number, not weekday", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 29), ctx, repo);
    expect(summary.headline).toBe("29 december. femte dagen i juloktaven.");
  });

  test("2025-12-02 Advent ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 2), ctx, repo);
    expect(summary.headline).toBe("2 december. Tisdag i första veckan i advent.");
  });

  test("2026-03-21 Lent ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 3, 21), ctx, repo);
    expect(summary.headline).toBe("21 mars. Lördag i fjärde veckan i fastan.");
  });

  test("2026-07-02 ordinary-time ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 2), ctx, repo);
    expect(summary.headline).toBe("2 juli. Torsdag i tolfte veckan under året.");
  });

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
