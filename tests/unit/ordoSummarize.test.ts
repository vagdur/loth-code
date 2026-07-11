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
    expect(summary.psalterWeekLine).toBe("Psaltarens vecka I");
    expect(summary.defaultBody).toBe("Allt från ferian.");
    expect(summary.hours).toHaveLength(0);
  });

  test("2025-12-02 Advent ferial collapses to single default line", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 2), ctx, repo);
    expect(summary.headline).toBe("2 december. Tisdag i första veckan i advent.");
    expect(summary.defaultBody).toBe("Allt från ferian.");
    expect(summary.hours).toHaveLength(0);
  });

  test("2025-11-30 first Advent Sunday collapses to single default line", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 11, 30), ctx, repo);
    expect(summary.headline).toBe("30 november. Första söndagen i Advent.");
    expect(summary.psalterWeekLine).toBe("Psaltarens vecka I");
    expect(summary.defaultBody).toBe("Allt från söndagen.");
  });

  test("2025-12-07 second Advent Sunday evening is second vespers of the Sunday", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 7), ctx, repo);
    expect(summary.headline).toBe("7 december. Andra söndagen i Advent.");
    expect(summary.defaultBody).toBe("Allt från söndagen.");
    expect(summary.communeLine).toBeUndefined();
    expect(summary.hours.find((h) => h.key === "firstVespers")).toBeUndefined();
  });

  test("2025-12-06 optional memoria shows ferial baseline and memoria block", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 6), ctx, repo);
    expect(summary.celebrationOptions).toContain("Alternativ:");
    expect(summary.defaultBody).toBe("Allt från ferian.");
    expect(summary.memoriaBlocks?.length).toBeGreaterThan(0);
    expect(summary.memoriaBlocks!.some((b) => b.hours.some((h) => h.prose.includes("commune")))).toBe(true);
  });

  test("2026-01-20 two optional memorias each get their own block and commons", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 20), ctx, repo);
    expect(summary.memoriaBlocks?.length).toBe(2);
    const fabian = summary.memoriaBlocks!.find((b) => b.heading.includes("Fabianus"));
    const sebastian = summary.memoriaBlocks!.find((b) => b.heading.includes("Sebastian"));
    expect(fabian).toBeDefined();
    expect(sebastian).toBeDefined();
    expect(fabian!.communeLine).toContain("en martyr");
    expect(fabian!.communeLine).toContain("herdar");
    expect(fabian!.communeLine).toContain("eller");
    expect(sebastian!.communeLine).toContain("en martyr");
    expect(sebastian!.communeLine).not.toContain("herdar");
    // §5.4 — first reading stays on the ferial day; only hymn and 2nd reading from Common.
    const fabianOor = fabian!.hours.find((h) => h.key === "officeOfReadings");
    expect(fabianOor).toBeDefined();
    expect(fabianOor!.prose).toContain("andra läsning");
    expect(fabianOor!.prose).not.toContain("första läsning");
    expect(fabianOor!.prose).not.toContain("första läsning från communet");
    expect(fabian!.hours.find((h) => h.key === "daytime")).toBeUndefined();
    expect(sebastian!.hours.find((h) => h.key === "daytime")).toBeUndefined();
  });

  test("2025-12-03 obligatory memoria uses except pattern not dual all-from", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 3), ctx, repo);
    expect(summary.headline).toContain("Francisco Xavier");
    const vespers = summary.hours.find((h) => h.key === "vespers");
    expect(vespers).toBeDefined();
    expect(vespers!.prose).toContain("utom");
    expect(vespers!.prose).toContain("ferian");
    expect(vespers!.prose).not.toMatch(/Allt från commune.*Allt från psaltaret/);
    const daytime = summary.hours.find((h) => h.key === "daytime");
    expect(daytime?.prose).not.toContain("commune");
    expect(daytime?.prose).not.toContain("communet");
    const allProse = summary.hours.map((h) => h.prose).join(" ");
    expect(allProse).not.toMatch(/\([^)]*Från commune/);
  });

  test("2026-07-11 St Benedict feast with compact hour summaries", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 11), ctx, repo);

    expect(summary.headline).toBe(
      "11 juli. S:t Benedictus av Nursia, abbot, Europas skyddspatron. Fest.",
    );
    expect(summary.psalterWeekLine).toBe("Psaltarens vecka II");
    expect(summary.communeLine).toBe("Commune: kyrkolärare");

    const lauds = summary.hours.find((h) => h.key === "lauds");
    expect(lauds).toBeDefined();
    expect(lauds!.prose).toContain("utom");
    expect(lauds!.prose).toContain("commune");
    expect(lauds!.prose).not.toContain("kyrkolärare");

    const compline = summary.hours.find((h) => h.key === "compline");
    expect(compline!.prose).toBe("Kompletorium för lördagen.");

    const oor = summary.hours.find((h) => h.key === "officeOfReadings");
    expect(oor!.prose).toContain("Te Deum");
    expect(oor!.prose).toContain("commune");
    expect(oor!.prose).not.toContain("kyrkolärare");

    const firstVespers = summary.hours.find((h) => h.key === "firstVespers");
    expect(firstVespers).toBeDefined();
    expect(firstVespers!.prose).toContain("utom");

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
