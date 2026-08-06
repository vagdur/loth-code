/**
 * Antiphon-only psalmody via psalm_unassigned sentinel.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { formatAntiphonPlain } from "../../src/assemblers/labels.js";
import { resolvePsalmAssignment } from "../../src/assemblers/types.js";
import {
  PSALM_UNASSIGNED,
  resolvePsalmText,
} from "../../src/assemblers/liturgicalText.js";
import { buildVespers } from "../../src/hours/buildVespers.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { LiturgicalFlags, SlotSource } from "../../src/types/hours.js";
import { resolveDay } from "../../src/calendar/index.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { dataRoot } from "../helpers/paths.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";

const flags: LiturgicalFlags = {
  alleluiaInAntiphons: false,
  alleluiaInIntroVerse: true,
  teDeum: false,
};

function makeUnassignedRepo(antiphonText: string): DataRepository {
  return {
    resolve(src: { kind: string; id?: string; field?: string }): unknown {
      if (src.kind === "saint" && src.id === "test_saint") {
        if (src.field === "vespers.psalmAssignments[0]") {
          return {
            psalmOrCanticleId: PSALM_UNASSIGNED,
            antiphon: { text: antiphonText },
          };
        }
      }
      if (src.kind === "psalter") {
        return {
          psalmOrCanticleId: "psalm_109",
          antiphon: { text: "Ferial psalter antiphon" },
        };
      }
      return undefined;
    },
    getPsalm: (id: string) =>
      id === PSALM_UNASSIGNED ? { verses: [] } : undefined,
    getCanticle: () => undefined,
    getMelody: () => undefined,
    getAssemblerLabels: () => ({ rubrics: { antiphonPrefix: "Ant." } }),
    getFixedTexts: () => ({ alleluia: "Alleluia." }),
  } as unknown as DataRepository;
}

describe("psalm_unassigned", () => {
  beforeAll(() => ensureSanctoralCalendar());

  test("resolvePsalmText returns empty string for sentinel", async () => {
    const repo = await loadRepository(dataRoot, "en");
    expect(resolvePsalmText(PSALM_UNASSIGNED, repo)).toBe("");
  });

  test("antiphon-only psalmody renders a single antiphon line", () => {
    const repo = makeUnassignedRepo("Proper feast antiphon");
    const assignmentRef: SlotSource = {
      kind: "fallback_chain",
      sources: [
        { kind: "saint", id: "test_saint", field: "vespers.psalmAssignments[0]" },
        { kind: "psalter", week: 1, day: "Monday", field: "vespers.psalmAssignments[0]" },
      ],
    };
    const assignment = resolvePsalmAssignment(assignmentRef, repo);
    expect(assignment?.antiphon.text).toBe("Proper feast antiphon");
    const psalmText = resolvePsalmText(assignment!.psalmOrCanticleId, repo);
    expect(psalmText).toBe("");
    const antiphon = formatAntiphonPlain(repo, assignment!.antiphon, flags);
    const rendered = psalmText.trim()
      ? `${antiphon}\n\n${psalmText}\n\n${antiphon}`
      : antiphon;
    expect(rendered).toBe("Ant. Proper feast antiphon");
    expect(rendered).not.toContain("Ferial psalter antiphon");
    expect(rendered).not.toContain("text not loaded");
  });

  test("presentation feast 2V resolves saint psalmody when proper slots exist", async () => {
    const repo = await loadRepository(dataRoot, "en");
    const saint = repo.resolve({
      kind: "saint",
      id: "presentation_of_the_lord",
      field: "vespers.psalmAssignments[0]",
    }) as { psalmOrCanticleId: string; antiphon: { text: string } } | undefined;

    expect(saint).toBeDefined();
    expect(saint!.psalmOrCanticleId).toBe(PSALM_UNASSIGNED);
    expect(resolvePsalmText(saint!.psalmOrCanticleId, repo)).toBe("");

    const day = resolveDay(new Date("2026-02-02T18:00:00Z"), "general");
    const vespers = buildVespers(day, false);
    const resolved = resolvePsalmAssignment(
      vespers.psalmSlots[0].assignmentRef,
      repo,
      day,
    );
    expect(resolved?.antiphon.text).toBe(saint!.antiphon.text);
  });
});
