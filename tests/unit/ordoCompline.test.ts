import { beforeAll, describe, expect, test } from "vitest";
import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { resolveDay } from "../../src/calendar/index.js";
import { complineWeekday, getOrdoLabels, summarizeComplineLabel } from "../../src/ordo/index.js";
import type { DataRepository } from "../../src/data/repository.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { dataRoot } from "../helpers/paths.js";

let repo: DataRepository;

beforeAll(async () => {
  const registry = await loadSanctoralRegistry(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await loadRepository(dataRoot, "sv");
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
