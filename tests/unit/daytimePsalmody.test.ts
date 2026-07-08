/**
 * Daytime prayer honours the 1-or-3 antiphon rule (GILH 122): a single proper
 * antiphon is sung around all three psalms; three give one antiphon per psalm;
 * with no proper override each psalm keeps its own antiphon.
 */

import { describe, expect, test } from "vitest";
import { renderDaytimePsalmodyPlain } from "../../src/assemblers/plainText.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { LiturgicalDay } from "../../src/types/calendar.js";
import type { AbstractDaytimePrayer, LiturgicalFlags, SlotSource } from "../../src/types/hours.js";
import type { Antiphon, PsalmAssignment } from "../../src/types/texts.js";

const flags: LiturgicalFlags = {
  alleluiaInAntiphons: false,
  alleluiaInIntroVerse: true,
  teDeum: false,
};

const day = { season: "ordinary_time" } as unknown as LiturgicalDay;

const slotSrc = (i: number) => ({ kind: "psalm-slot", i } as unknown as SlotSource);
const PROPER_SRC = { kind: "proper-antiphons" } as unknown as SlotSource;

/** Minimal repo: psalm slots resolve to their own-antiphon assignment; the
 *  proper-antiphons source resolves to whatever the test supplies. */
function makeRepo(properAntiphons: Antiphon[] | undefined): DataRepository {
  return {
    resolve(src: { kind: string; i?: number }): unknown {
      if (src.kind === "psalm-slot") {
        return {
          psalmOrCanticleId: `psalm_${src.i}`,
          antiphon: { text: `own antiphon ${src.i}` },
        } satisfies PsalmAssignment;
      }
      if (src.kind === "proper-antiphons") return properAntiphons;
      return undefined;
    },
    getMelody: () => undefined,
    getPsalm: (id: string) => ({ verses: [{ number: 1, text: `${id} text` }] }),
    getCanticle: () => undefined,
    getAssemblerLabels: () => ({ rubrics: { antiphonPrefix: "Ant." } }),
    getFixedTexts: () => ({ alleluia: "Alleluia." }),
  } as unknown as DataRepository;
}

function makeHour(properAntiphonsRef?: SlotSource): AbstractDaytimePrayer {
  return {
    kind: "sext",
    liturgicalDay: day,
    flags,
    hymnRef: slotSrc(-1),
    psalmSlots: [
      { assignmentRef: slotSrc(0) },
      { assignmentRef: slotSrc(1) },
      { assignmentRef: slotSrc(2) },
    ],
    ...(properAntiphonsRef ? { properAntiphonsRef } : {}),
    shortReadingRef: slotSrc(-1),
    versicleRef: slotSrc(-1),
    concludingPrayerRef: slotSrc(-1),
  };
}

describe("renderDaytimePsalmodyPlain", () => {
  test("one proper antiphon wraps all three psalms", () => {
    const repo = makeRepo([{ text: "Shared antiphon" }]);
    const out = renderDaytimePsalmodyPlain(repo, makeHour(PROPER_SRC), flags);
    expect(out).toEqual([
      "Ant. Shared antiphon",
      "1. psalm_0 text",
      "1. psalm_1 text",
      "1. psalm_2 text",
      "Ant. Shared antiphon",
    ]);
    // The psalms carry no antiphon of their own in shared mode.
    expect(out[1]).not.toContain("Ant.");
  });

  test("three proper antiphons give one per psalm", () => {
    const proper: Antiphon[] = [
      { text: "Proper 0" }, { text: "Proper 1" }, { text: "Proper 2" },
    ];
    const repo = makeRepo(proper);
    const out = renderDaytimePsalmodyPlain(repo, makeHour(PROPER_SRC), flags);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Ant. Proper 0\n\n1. psalm_0 text\n\nAnt. Proper 0");
    expect(out[2]).toContain("Ant. Proper 2");
    expect(out[1]).not.toContain("own antiphon");
  });

  test("no proper override keeps each psalm's own antiphon", () => {
    const repo = makeRepo(undefined);
    const out = renderDaytimePsalmodyPlain(repo, makeHour(), flags);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("Ant. own antiphon 0\n\n1. psalm_0 text\n\nAnt. own antiphon 0");
    expect(out[2]).toContain("own antiphon 2");
  });

  test("a proper array of two (neither 1 nor 3) falls back to own antiphons", () => {
    const repo = makeRepo([{ text: "A" }, { text: "B" }]);
    const out = renderDaytimePsalmodyPlain(repo, makeHour(PROPER_SRC), flags);
    expect(out[0]).toContain("own antiphon 0");
  });
});
