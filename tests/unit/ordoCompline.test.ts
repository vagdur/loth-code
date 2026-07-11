import { beforeAll, describe, expect, test } from "vitest";
import { SanctoralCalendarRegistry } from "../../src/calendar/sanctoralRegistry.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { resolveDay } from "../../src/calendar/index.js";
import { complineWeekday, getOrdoLabels, summarizeComplineLabel } from "../../src/ordo/index.js";
import { DataRepository } from "../../src/data/repository.js";
import { dataRoot } from "../helpers/paths.js";

let repo: ReturnType<typeof DataRepository.load> extends Promise<infer R> ? R : never;

beforeAll(async () => {
  const registry = await SanctoralCalendarRegistry.load(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await DataRepository.load(dataRoot, "sv");
});

describe("compline weekday label", () => {
  test("Saturday feast uses lördagen", () => {
    const day = resolveDay(utcDate(2026, 7, 11), "stockholm");
    expect(complineWeekday(day)).toBe("Saturday");
    const labels = getOrdoLabels(repo);
    expect(summarizeComplineLabel(day, labels)).toBe("Kompletorium för lördagen.");
  });

  test("solemnity uses söndagen", () => {
    const day = resolveDay(utcDate(2026, 12, 25), "stockholm");
    if (day.celebration.type !== "solemnity") return;
    expect(complineWeekday(day)).toBe("Sunday");
    expect(summarizeComplineLabel(day, getOrdoLabels(repo))).toBe(
      "Kompletorium för söndagen.",
    );
  });
});
