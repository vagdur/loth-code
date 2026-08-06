import { beforeAll, describe, expect, test } from "vitest";
import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { liturgicalYearRange, ordoContext, summarizeOrdoDay } from "../../src/ordo/index.js";
import { dataRoot } from "../helpers/paths.js";

let repo: DataRepository;
const ctx = ordoContext("stockholm");

beforeAll(async () => {
  const registry = await loadSanctoralRegistry(dataRoot, "en");
  initSanctoralRegistry(registry);
  repo = await loadRepository(dataRoot, "en");
});

describe("summarizeOrdoDay (stockholm)", () => {
  test("2026-01-04 Sunday after Christmas uses computed ordinal, not calendar date", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 4), ctx, repo);
    expect(summary.headline).toBe("4 January. Second Sunday after Christmas.");
  });

  test("2025-01-04 Saturday in Christmas season uses weekday ferial title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 1, 4), ctx, repo);
    expect(summary.headline).toBe("4 January. Saturday of Christmastide.");
  });

  test("2025-12-25 Christmas solemnity uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 25), ctx, repo);
    expect(summary.headline).toBe("25 December. Christmas Day. Solemnity.");
  });

  test("2026-01-11 Baptism of the Lord uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 11), ctx, repo);
    expect(summary.headline).toBe("11 January. The Baptism of the Lord. Solemnity.");
  });

  test("2025-12-28 Holy Family uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 28), ctx, repo);
    expect(summary.headline).toBe("28 December. The Holy Family. Feast of the Lord on a Sunday.");
  });

  test("2026-04-05 Easter Sunday uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 4, 5), ctx, repo);
    expect(summary.headline).toBe("5 April. Easter Sunday. Triduum.");
  });

  test("2026-04-06 Easter Monday uses localized title", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 4, 6), ctx, repo);
    expect(summary.headline).toBe("6 April. Monday in the Octave of Easter. Solemnity.");
  });

  test("2025-12-17 Advent dec 17-24 ferial uses same weekly title as other Advent weekdays", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 17), ctx, repo);
    expect(summary.headline).toBe("17 December. Wednesday of the third week of Advent.");
  });

  test("2025-12-22 Advent dec 17-24 ferial uses same weekly title as other Advent weekdays", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 22), ctx, repo);
    expect(summary.headline).toBe("22 December. Monday of the fourth week of Advent.");
  });

  test("2025-11-30 first Advent Sunday uses readable title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 11, 30), ctx, repo);
    expect(summary.headline).toBe("30 November. First Sunday of Advent.");
  });

  test("2025-12-21 fourth Advent Sunday on dec 21 uses readable title", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 21), ctx, repo);
    expect(summary.headline).toBe("21 December. Fourth Sunday of Advent.");
  });

  test("2026-02-22 first Lent Sunday uses readable title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 2, 22), ctx, repo);
    expect(summary.headline).toBe("22 February. First Sunday of Lent.");
  });

  test("2026-01-18 first OT Sunday keeps numeric form without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 18), ctx, repo);
    expect(summary.headline).toBe("18 January. Second Sunday in Ordinary Time.");
  });

  test("2025-12-29 Christmas octave ferial uses octave day number, not weekday", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 29), ctx, repo);
    expect(summary.headline).toBe("29 December. fifth day of the Octave of Christmas.");
  });

  test("2025-12-02 Advent ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 2), ctx, repo);
    expect(summary.headline).toBe("2 December. Tuesday of the first week of Advent.");
  });

  test("2026-03-21 Lent ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 3, 21), ctx, repo);
    expect(summary.headline).toBe("21 March. Saturday of the fourth week of Lent.");
  });

  test("2026-07-02 ordinary-time ferial uses readable Swedish title without rank", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 2), ctx, repo);
    expect(summary.headline).toBe("2 July. Thursday of the thirteenth week in Ordinary Time.");
    expect(summary.psalterWeekLine).toBe("Psalter week I");
    expect(summary.defaultBody).toBe("All from the weekday.");
    expect(summary.hours).toHaveLength(0);
  });

  test("2026-07-12 fifteenth Sunday under året matches Ordo 2025-2026", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 12), ctx, repo);
    expect(summary.headline).toBe("12 July. Fifteenth Sunday in Ordinary Time.");
  });

  test("2025-12-02 Advent ferial collapses to single default line", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 2), ctx, repo);
    expect(summary.headline).toBe("2 December. Tuesday of the first week of Advent.");
    expect(summary.defaultBody).toBe("All from the weekday.");
    expect(summary.hours).toHaveLength(0);
  });

  test("2025-11-30 first Advent Sunday collapses to single default line", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 11, 30), ctx, repo);
    expect(summary.headline).toBe("30 November. First Sunday of Advent.");
    expect(summary.psalterWeekLine).toBe("Psalter week I");
    expect(summary.defaultBody).toBe("All from the Sunday.");
  });

  test("2025-12-07 second Advent Sunday evening is second vespers of the Sunday", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 7), ctx, repo);
    expect(summary.headline).toBe("7 December. Second Sunday of Advent.");
    expect(summary.defaultBody).toBe("All from the Sunday.");
    expect(summary.communeLine).toBeUndefined();
    expect(summary.hours.find((h) => h.key === "firstVespers")).toBeUndefined();
  });

  test("2025-12-06 optional memoria shows ferial baseline and memoria block", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 6), ctx, repo);
    expect(summary.celebrationOptions).toContain("Alternatives:");
    expect(summary.defaultBody).toBe("All from the weekday.");
    expect(summary.memoriaBlocks?.length).toBeGreaterThan(0);
    expect(summary.memoriaBlocks!.some((b) => b.hours.some((h) => h.prose.includes("the common")))).toBe(true);
  });

  test("2026-01-20 two optional memorias each get their own block and commons", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 20), ctx, repo);
    expect(summary.memoriaBlocks?.length).toBe(2);
    const fabian = summary.memoriaBlocks!.find((b) => b.heading.includes("Fabian"));
    const sebastian = summary.memoriaBlocks!.find((b) => b.heading.includes("Sebastian"));
    expect(fabian).toBeDefined();
    expect(sebastian).toBeDefined();
    expect(fabian!.communeLine).toContain("martyrs");
    expect(fabian!.communeLine).toContain("pastors");
    expect(fabian!.communeLine).toContain("or");
    expect(sebastian!.communeLine).toContain("martyrs");
    expect(sebastian!.communeLine).not.toContain("pastors");
    // §5.4 — first reading stays on the ferial day; hymn ad lib; 2nd reading only when proper.
    const fabianOor = fabian!.hours.find((h) => h.key === "officeOfReadings");
    expect(fabianOor).toBeDefined();
    expect(fabianOor!.prose).toContain("Hymn");
    expect(fabianOor!.prose).toContain("the common or the weekday");
    expect(fabianOor!.prose).not.toContain("second reading");
    expect(fabianOor!.prose).not.toContain("first reading");
    expect(fabianOor!.prose).not.toContain("first reading from the common");
    expect(fabian!.hours.find((h) => h.key === "daytime")).toBeUndefined();
    expect(sebastian!.hours.find((h) => h.key === "daytime")).toBeUndefined();
  });

  // GILH 119 / 235 b): the Benedictus antiphon is ad libitum from the Common or
  // the ferial day, exactly like the hymn, short reading and intercessions, so it
  // is listed together with them rather than fixed to the Common.
  test("2026-01-20 Fabianus lauds lists the canticle antiphon among the optional parts", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 1, 20), ctx, repo);
    const fabian = summary.memoriaBlocks!.find((b) => b.heading.includes("Fabian"));
    expect(fabian).toBeDefined();
    const lauds = fabian!.hours.find((h) => h.key === "lauds");
    expect(lauds).toBeDefined();
    expect(lauds!.prose).toContain(
      "Hymn, short reading, Benedictus antiphon, and intercessions from the common or the weekday",
    );
    expect(lauds!.prose).not.toContain("Benedictus antiphon from the common");
    expect(lauds!.prose).not.toContain("except");
  });

  test("2025-12-03 obligatory memoria uses positive listing not dual all-from", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 3), ctx, repo);
    expect(summary.headline).toContain("Francis Xavier");
    const vespers = summary.hours.find((h) => h.key === "vespers");
    expect(vespers).toBeDefined();
    expect(vespers!.prose).toContain("the weekday");
    expect(vespers!.prose).not.toContain("except");
    expect(vespers!.prose).not.toMatch(/All from the common.*All from the psalter/);
    const daytime = summary.hours.find((h) => h.key === "daytime");
    expect(daytime?.prose).not.toContain("the common");
    expect(daytime?.prose).not.toContain("the common");
    const allProse = summary.hours.map((h) => h.prose).join(" ");
    expect(allProse).not.toMatch(/\([^)]*From the common/);
  });

  test("2026-07-11 St Benedict feast with compact hour summaries", () => {
    const summary = summarizeOrdoDay(utcDate(2026, 7, 11), ctx, repo);

    expect(summary.headline).toBe(
      "11 July. Saint Benedict, Abbot. Feast.",
    );
    expect(summary.psalterWeekLine).toBe("Psalter week II");
    expect(summary.communeLine).toBe("Common: [doctors variant 1]");

    const lauds = summary.hours.find((h) => h.key === "lauds");
    expect(lauds).toBeDefined();
    expect(lauds!.prose).toContain("from the common");
    expect(lauds!.prose).not.toContain("except");
    expect(lauds!.prose).not.toContain("doctors");

    const compline = summary.hours.find((h) => h.key === "compline");
    expect(compline!.prose).toBe("Compline for Saturday.");

    const vespers = summary.hours.find((h) => h.key === "vespers");
    expect(vespers).toBeUndefined();

    const oor = summary.hours.find((h) => h.key === "officeOfReadings");
    expect(oor!.prose).toContain("Te Deum");
    expect(oor!.prose).toContain("the weekday");
    expect(oor!.prose).not.toContain("doctors");

    const firstVespers = summary.hours.find((h) => h.key === "firstVespers");
    expect(firstVespers).toBeDefined();
    expect(firstVespers!.prose).toContain("the Sunday");

    const melodyOptions = summary.hours.some((h) => h.prose.includes("melody"));
    expect(melodyOptions).toBe(false);
  });

  test("2025-12-08 Immaculate Conception solemnity uses common daytime antiphons and proper vespers responsory", () => {
    const summary = summarizeOrdoDay(utcDate(2025, 12, 8), ctx, repo);
    expect(summary.headline).toBe(
      "8 December. The Immaculate Conception of the Blessed Virgin Mary. Solemnity.",
    );
    expect(summary.communeLine).toBe("Common: [bvm variant 1]");

    // The solemnity has no Daytime Prayer texts of its own, so that hour draws
    // on the Common while the principal Hours stay with the proper.
    const daytime = summary.hours.find((h) => h.key === "daytime");
    expect(daytime).toBeDefined();
    expect(daytime!.prose).toContain("Antiphons and short reading from the common");
    expect(daytime!.prose).not.toContain("from the proper");

    const vespers = summary.hours.find((h) => h.key === "vespers");
    expect(vespers).toBeDefined();
    expect(vespers!.prose).toContain("responsory");
    expect(vespers!.prose).toContain("from the proper");
    expect(vespers!.prose).not.toContain("from the weekday");

    const oor = summary.hours.find((h) => h.key === "officeOfReadings");
    expect(oor!.prose).toContain("Te Deum");
    expect(oor!.prose).toContain("Versicle from the weekday");
    expect(oor!.prose).not.toMatch(/first reading.*the weekday/);
  });

  test("liturgical year 2025/2026 spans Advent 2025 through Christ the King 2026", () => {
    const range = liturgicalYearRange(2026, "stockholm");
    expect(range.from.getUTCFullYear()).toBe(2025);
    expect(range.from.getUTCMonth()).toBe(10);
    expect(range.to.getUTCFullYear()).toBe(2026);
    expect(range.to.getUTCMonth()).toBe(10);
  });
});
