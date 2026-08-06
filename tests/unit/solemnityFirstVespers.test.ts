/**
 * First Vespers of a solemnity whose proper carries no psalmody.
 *
 * Psalmody is never sung without an antiphon, and an antiphon always brings
 * its psalm with it, so the slot has to end somewhere that holds both. That
 * is the Common — which is where the Laudate psalms such an hour uses live,
 * under the Common's own antiphons. A chain ending at a bare psalm instead
 * would hand the renderers a psalm with no antiphon, and they would throw.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { resolvePsalmAssignment } from "../../src/assemblers/types.js";
import { utcDate } from "../../src/calendar/computus.js";
import { resolveDay, defaultContext } from "../../src/calendar/index.js";
import { buildDay, eveningVespers } from "../../src/hours/index.js";
import type { AbstractVespers } from "../../src/types/hours.js";
import type { DataRepository } from "../../src/data/repository.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { dataRoot, defaultLocale } from "../helpers/paths.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";

/** Eve of Ss Peter and Paul: a solemnity with a Common and no proper psalmody. */
const EVE_WITH_COMMON = utcDate(2026, 6, 28);
/** Eve of the Nativity of John the Baptist: a solemnity with neither. */
const EVE_WITHOUT_COMMON = utcDate(2026, 6, 23);
/** Eve of Trinity Sunday: the one seasonal key here with its own psalmody. */
const EVE_WITH_PROPER = utcDate(2026, 5, 30);

function firstVespersOf(date: Date): AbstractVespers {
  const day = resolveDay(date, "general");
  const abs = buildDay(day, defaultContext("general"));
  return abs.firstVespers ?? eveningVespers(abs);
}

describe("First Vespers psalmody of a solemnity", () => {
  let repo: DataRepository;

  beforeAll(async () => {
    await ensureSanctoralCalendar();
    repo = await loadRepository(dataRoot, defaultLocale);
  });

  test.each([
    ["with a Common", EVE_WITH_COMMON],
    ["without a Common", EVE_WITHOUT_COMMON],
    ["with a proper", EVE_WITH_PROPER],
  ])("every slot resolves to an antiphon and its psalm (%s)", (_name, date) => {
    const day = resolveDay(date, "general");
    const vespers = firstVespersOf(date);

    for (const [i, slot] of vespers.psalmSlots.entries()) {
      const assignment = resolvePsalmAssignment(slot.assignmentRef, repo, day);
      expect(assignment, `slot ${i} resolved to nothing`).toBeDefined();
      expect(assignment!.antiphon?.text, `slot ${i} has no antiphon`).toBeTruthy();
      expect(assignment!.psalmOrCanticleId, `slot ${i} names no psalm`).toBeTruthy();
    }
  });

  test("the Common supplies the Laudate psalms under its own antiphons", () => {
    const day = resolveDay(EVE_WITH_COMMON, "general");
    const vespers = firstVespersOf(EVE_WITH_COMMON);
    const first = resolvePsalmAssignment(vespers.psalmSlots[0]!.assignmentRef, repo, day);

    expect(first?.psalmOrCanticleId).toBe("psalm_112");
    expect(first?.antiphon.text).toContain("apostles");
  });

  test("a proper that supplies psalmody wins over the Common and psalter", () => {
    const day = resolveDay(EVE_WITH_PROPER, "general");
    const vespers = firstVespersOf(EVE_WITH_PROPER);
    const first = resolvePsalmAssignment(vespers.psalmSlots[0]!.assignmentRef, repo, day);

    expect(first?.antiphon.text).toContain("trinity_sunday");
  });

  test("the hour renders, antiphons and all", () => {
    const text = new PlainTextAssembler().assembleVespers(firstVespersOf(EVE_WITH_COMMON), repo);
    const antiphonPrefix = repo.getAssemblerLabels().rubrics.antiphonPrefix;
    // Three psalmody antiphons, each said before and after its psalm, plus the
    // Magnificat antiphon — the exact count is the assembler's business, but
    // an hour with no antiphon at all would mean the chain stopped short.
    expect(text.split(`${antiphonPrefix} `).length - 1).toBeGreaterThanOrEqual(6);
  });
});
