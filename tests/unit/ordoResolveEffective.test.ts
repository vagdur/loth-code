import { beforeAll, describe, expect, test } from "vitest";
import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { buildDay } from "../../src/hours/index.js";
import { resolveDay } from "../../src/calendar/index.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { daySlots, slotPath } from "../../src/options/slotTable.js";
import { ordoContext, resolveEffectiveSource } from "../../src/ordo/index.js";
import { dataRoot } from "../helpers/paths.js";

let repo: DataRepository;
const ctx = ordoContext("stockholm");

beforeAll(async () => {
  const registry = await loadSanctoralRegistry(dataRoot, "sv");
  initSanctoralRegistry(registry);
  repo = await loadRepository(dataRoot, "sv");
});

describe("resolveEffectiveSource", () => {
  test("strict fallback chain picks first resolvable source", () => {
    const date = utcDate(2026, 7, 11);
    const day = resolveDay(date, ctx.calendarId);
    const abs = buildDay(day, ctx);
    const laudsHymn = abs.lauds.hymnRef;
    const effective = resolveEffectiveSource(laudsHymn, repo);
    expect(effective?.winner.kind).toBe("saint");
    if (effective?.winner.kind === "saint") {
      expect(effective.winner.id).toBe("benedict_of_nursia");
    }
  });

  test("ad-lib tail alternatives are listed when head is empty", () => {
    const date = utcDate(2026, 1, 10);
    for (let offset = 0; offset < 365; offset++) {
      const d = utcDate(2026, 1, 10 + offset);
      const day = resolveDay(d, ctx.calendarId);
      if (day.celebration.type !== "optional_memoria") continue;
      const abs = buildDay(day, ctx);
      const slot = daySlots(abs).find((s) => s.slotKey === "hymn" && s.hourKey === "lauds");
      expect(slot).toBeDefined();
      const effective = resolveEffectiveSource(slot!.source, repo, {
        optionPath: slotPath(slot!.hourKey, slot!.slotKey),
      });
      if (
        slot!.source.kind === "fallback_chain" &&
        slot!.source.adLibFrom !== undefined
      ) {
        const headYields = slot!.source.sources
          .slice(0, slot!.source.adLibFrom)
          .some((s) => repo.resolve(s) != null);
        if (!headYields) {
          expect(effective?.alternatives?.length).toBeGreaterThanOrEqual(2);
        }
      }
      return;
    }
    throw new Error("no optional memoria found in 2026");
  });
});
