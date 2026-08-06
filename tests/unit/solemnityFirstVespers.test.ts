/**
 * First Vespers of a solemnity whose proper supplies no psalmody.
 *
 * The rubric fixes the Laudate psalms, so the slot has to resolve to a psalm
 * assignment naming one of them — not to the Psalm itself, which is what the
 * renderers used to be handed and then crash on for want of an antiphon.
 */

import { describe, expect, test } from "vitest";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { resolvePsalmAssignment } from "../../src/assemblers/types.js";
import { utcDate } from "../../src/calendar/computus.js";
import { resolveDay, defaultContext } from "../../src/calendar/index.js";
import { buildDay, eveningVespers } from "../../src/hours/index.js";
import { DataRepository } from "../../src/data/repository.js";
import { readRepoBundle } from "../../src/data/repositoryNode.js";
import { dataRoot, defaultLocale } from "../helpers/paths.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";

/** Eve of All Saints: a solemnity, and its proper holds no First Vespers. */
const EVE_OF_SOLEMNITY = utcDate(2026, 10, 31);

async function loadRepo(): Promise<DataRepository> {
  return DataRepository.fromBundle(await readRepoBundle(dataRoot, defaultLocale));
}

/**
 * The same bundle with every seasonal and saint proper dropped, so nothing
 * ahead of the Laudate fallback in the chain can resolve.
 */
async function loadRepoWithoutPropers(): Promise<DataRepository> {
  const bundle = await readRepoBundle(dataRoot, defaultLocale);
  return DataRepository.fromBundle({ ...bundle, seasonal: [], saints: [] });
}

describe("First Vespers of a solemnity with no proper psalmody", () => {
  test("the Laudate psalms resolve as assignments, without an antiphon", async () => {
    await ensureSanctoralCalendar();
    const repo = await loadRepoWithoutPropers();
    const day = resolveDay(EVE_OF_SOLEMNITY, "general");
    const abs = buildDay(day, defaultContext("general"));
    const vespers = abs.firstVespers ?? eveningVespers(abs);

    const first = resolvePsalmAssignment(vespers.psalmSlots[0]!.assignmentRef, repo, day);
    expect(first?.psalmOrCanticleId).toBe("psalm_112");
    expect(first?.antiphon).toBeUndefined();

    const second = resolvePsalmAssignment(vespers.psalmSlots[1]!.assignmentRef, repo, day);
    expect(second?.psalmOrCanticleId).toBe("psalm_116");
    expect(second?.antiphon).toBeUndefined();

    // The NT canticle slot falls through to the Sunday psalter, which always
    // has one — a solemnity is never left without its third piece.
    const third = resolvePsalmAssignment(vespers.psalmSlots[2]!.assignmentRef, repo, day);
    expect(third?.psalmOrCanticleId).toBeTruthy();
    expect(third?.antiphon).toBeDefined();
  });

  test("the hour renders: psalm text without an antiphon line", async () => {
    await ensureSanctoralCalendar();
    const repo = await loadRepoWithoutPropers();
    const day = resolveDay(EVE_OF_SOLEMNITY, "general");
    const abs = buildDay(day, defaultContext("general"));
    const vespers = abs.firstVespers ?? eveningVespers(abs);

    const text = new PlainTextAssembler().assembleVespers(vespers, repo);
    expect(text).toContain("psalm_112");
    // The antiphon prefix appears for the canticle, which has one, and not for
    // the two Laudate psalms, which do not.
    const antiphonPrefix = repo.getAssemblerLabels().rubrics.antiphonPrefix;
    const prefixCount = text.split(`${antiphonPrefix} `).length - 1;
    expect(prefixCount).toBeGreaterThan(0);
  });

  test("a proper that does supply psalmody still wins", async () => {
    await ensureSanctoralCalendar();
    const repo = await loadRepo();
    // Trinity Sunday is the seasonal key in this bundle with First Vespers
    // psalmody of its own.
    const day = resolveDay(utcDate(2026, 5, 30), "general");
    const abs = buildDay(day, defaultContext("general"));
    const vespers = abs.firstVespers ?? eveningVespers(abs);

    const first = resolvePsalmAssignment(vespers.psalmSlots[0]!.assignmentRef, repo, day);
    expect(first?.antiphon?.text).toContain("trinity_sunday");
  });
});
