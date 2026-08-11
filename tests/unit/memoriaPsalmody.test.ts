/**
 * office-spec §5.4 / data-structure.md §9.1 — memoria Lauds/Vespers psalmody
 * is the ferial day (unless the saint has proper antiphons), never the Common.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { resolvePsalmAssignment } from "../../src/assemblers/types.js";
import { resolveDay } from "../../src/calendar/index.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import type { DataRepository } from "../../src/data/repository.js";
import { buildLauds } from "../../src/hours/buildLauds.js";
import { buildVespers } from "../../src/hours/buildVespers.js";
import type { FallbackChain, SlotSource, SlotSourceDirect } from "../../src/types/hours.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";
import { dataRoot } from "../helpers/paths.js";

const defaultContext = {
  daytimeHoursSaid: ["sext" as const],
  oorIsFirstHour: true,
  laudsFollowsOorDirectly: true,
  oorSaidAtNight: false,
  complineAfterFirstVespers: false,
};

function flatten(src: SlotSource): SlotSourceDirect[] {
  if (src.kind === "fallback_chain") {
    return (src as FallbackChain).sources.flatMap(flatten);
  }
  return [src];
}

describe("memoria psalmody", () => {
  let repo: DataRepository;
  beforeAll(async () => {
    await ensureSanctoralCalendar();
    repo = await loadRepository(dataRoot, "en");
  });

  // 2026-08-11: obligatory memoria of St Clare (Common of Virgins has
  // Vespers psalmody — must not win over the ferial Tuesday Week III).
  test("Clare Vespers uses ferial antiphons, not the Common of Virgins", () => {
    const day = resolveDay(new Date("2026-08-11T12:00:00Z"), "general");
    expect(day.celebration.saintId).toBe("clare_virgin");
    expect(day.celebration.type).toBe("obligatory_memoria");

    const vespers = buildVespers(day, false);
    for (const slot of vespers.psalmSlots) {
      const kinds = flatten(slot.assignmentRef).map((s) => s.kind);
      expect(kinds).not.toContain("common");
      expect(kinds).toContain("psalter");

      const resolved = resolvePsalmAssignment(slot.assignmentRef, repo, day);
      expect(resolved?.antiphon.text).toBeDefined();
      expect(resolved!.antiphon.text).not.toMatch(/virgins/i);
    }
  });

  test("Clare Lauds psalmody chain omits the Common", () => {
    const day = resolveDay(new Date("2026-08-11T12:00:00Z"), "general");
    const lauds = buildLauds(day, defaultContext);
    for (const slot of lauds.psalmSlots) {
      expect(flatten(slot.assignmentRef).map((s) => s.kind)).not.toContain("common");
    }
  });
});
