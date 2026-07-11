/**
 * office-spec §5.4–§5.6 — celebration alternatives (feria / optional
 * memorials / Saturday BVM) and applying a celebration choice in resolveDay.
 */

import { beforeAll, describe, expect, test } from "vitest";
import { utcDate } from "../../src/calendar/computus.js";
import {
  BVM_SATURDAY_SAINT_ID,
  enumerateCelebrationAlternatives,
  resolveCelebrationFromParts,
} from "../../src/calendar/celebrationRanking.js";
import { resolveDay } from "../../src/calendar/index.js";
import { ensureSanctoralCalendar } from "../helpers/initSanctoralCalendar.js";
import type { CalendarSaint } from "../../src/types/sanctoralCalendar.js";

function mockSaint(
  id: string,
  rank: CalendarSaint["rank"],
): CalendarSaint {
  const nominal = utcDate(2026, 10, 9);
  return {
    saintId: id,
    name: `Saint ${id}`,
    rank,
    applicableCommons: ["holy_men_women"],
    nominalDate: () => nominal,
    celebrationDate: () => nominal,
  };
}

describe("resolveCelebrationFromParts in partial-suppression seasons (§238)", () => {
  test("obligatory memoria on a Lent ferial yields the ferial office with addendum flags", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2026, 3, 6),
      "lent",
      "lent_w1_fri",
      [mockSaint("st_henrik", "obligatory_memoria")],
    );
    expect(c.type).toBe("privileged_ferial");
    expect(c.source).toBe("seasonal");
    expect(c.memoriaReducedToOptional).toBe(true);
    expect(c.allowMemoriaAddendum).toBe(true);
    expect(c.saintId).toBe("st_henrik");
  });

  test("optional memoria in the octave of Christmas is reduced to the addendum", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2026, 12, 29),
      "christmas",
      "christmas_dec29",
      [mockSaint("thomas_becket", "optional_memoria")],
    );
    expect(c.type).toBe("privileged_ferial");
    expect(c.memoriaReducedToOptional).toBe(false); // optional already
    expect(c.allowMemoriaAddendum).toBe(true);
    expect(c.saintId).toBe("thomas_becket");
  });

  test("obligatory memoria on an ordinary weekday still wins as a full office", () => {
    const c = resolveCelebrationFromParts(
      utcDate(2024, 10, 4),
      "ordinary_time",
      "ot_w27_fri",
      [mockSaint("francis_of_assisi", "obligatory_memoria")],
    );
    expect(c.type).toBe("obligatory_memoria");
    expect(c.saintId).toBe("francis_of_assisi");
  });

  test("obligatory memoria is commemorated over a coinciding optional, regardless of id order", () => {
    // Regression: on a suppression date the obligatory memoria must be the
    // commemoration even when an optional memoria sorts alphabetically first
    // (the demotion must not collapse the obligatory/optional ordering).
    const c = resolveCelebrationFromParts(
      utcDate(2026, 3, 6),
      "lent",
      "lent_w1_fri",
      [
        mockSaint("aaa_optional", "optional_memoria"),
        mockSaint("zzz_obligatory", "obligatory_memoria"),
      ],
    );
    expect(c.type).toBe("privileged_ferial");
    expect(c.saintId).toBe("zzz_obligatory");
    expect(c.memoriaReducedToOptional).toBe(true); // obligatory → optional
    expect(c.allowMemoriaAddendum).toBe(true);
  });

  test("memoria on a Christmas-season ferial after the octave stays a full office", () => {
    // Regression: the octave runs Dec 25–Jan 1; a memoria on Jan 2 (still the
    // Christmas season, but past the octave) must NOT be suppressed.
    const c = resolveCelebrationFromParts(
      utcDate(2027, 1, 2),
      "christmas",
      null,
      [mockSaint("basil_and_gregory", "obligatory_memoria")],
    );
    expect(c.type).toBe("obligatory_memoria");
    expect(c.saintId).toBe("basil_and_gregory");
    expect(c.allowMemoriaAddendum).toBe(false);
  });
});

describe("enumerateCelebrationAlternatives", () => {
  test("ordinary ferial with one optional memoria: feria + saint, saint default", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 10, 9),
      "ordinary_time",
      "ot_w27_fri",
      [mockSaint("dionysius", "optional_memoria")],
    );
    expect(alts.map((a) => a.choiceId)).toEqual(["feria", "saint:dionysius"]);
    expect(alts.find((a) => a.isDefault)?.choiceId).toBe("saint:dionysius");
    const feria = alts.find((a) => a.choiceId === "feria")!.celebration;
    expect(feria.type).toBe("ordinary_ferial");
    expect(feria.allowMemoriaAddendum).toBe(false);
    const saint = alts.find((a) => a.choiceId === "saint:dionysius")!.celebration;
    expect(saint.type).toBe("optional_memoria");
    expect(saint.saintId).toBe("dionysius");
  });

  test("two optional memorials give three alternatives", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 10, 9),
      "ordinary_time",
      "ot_w27_fri",
      [mockSaint("dionysius", "optional_memoria"), mockSaint("leonardi", "optional_memoria")],
    );
    expect(alts.map((a) => a.choiceId)).toEqual([
      "feria", "saint:dionysius", "saint:leonardi",
    ]);
    // Default = the ranking winner (id tie-break).
    expect(alts.find((a) => a.isDefault)?.choiceId).toBe("saint:dionysius");
    expect(alts.filter((a) => a.isDefault)).toHaveLength(1);
  });

  test("Lent ferial with obligatory memoria: addendum-or-not, addendum default", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 3, 6),
      "lent",
      "lent_w1_fri",
      [mockSaint("st_henrik", "obligatory_memoria")],
    );
    expect(alts.map((a) => a.choiceId)).toEqual(["feria", "saint:st_henrik"]);
    expect(alts.find((a) => a.isDefault)?.choiceId).toBe("saint:st_henrik");
    const feria = alts.find((a) => a.choiceId === "feria")!.celebration;
    expect(feria.type).toBe("privileged_ferial");
    expect(feria.allowMemoriaAddendum).toBe(false);
    expect(feria.saintId).toBeUndefined();
    const saint = alts.find((a) => a.choiceId === "saint:st_henrik")!.celebration;
    expect(saint.type).toBe("privileged_ferial"); // ferial office + addendum (GILH 239)
    expect(saint.allowMemoriaAddendum).toBe(true);
    expect(saint.saintId).toBe("st_henrik");
  });

  test("Sunday fully suppresses the memoria: single default entry", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 10, 4),
      "ordinary_time",
      "ot_w27_sun",
      [mockSaint("francis_of_assisi", "obligatory_memoria")],
    );
    expect(alts).toHaveLength(1);
    expect(alts[0]!.isDefault).toBe(true);
    expect(alts[0]!.celebration.type).toBe("sunday");
  });

  test("winning obligatory memoria on ordinary day: no choice (GILH 221)", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2024, 10, 4),
      "ordinary_time",
      "ot_w27_fri",
      [
        mockSaint("francis_of_assisi", "obligatory_memoria"),
        mockSaint("dionysius", "optional_memoria"),
      ],
    );
    expect(alts).toHaveLength(1);
    expect(alts[0]!.choiceId).toBe("saint:francis_of_assisi");
  });

  test("ordinary Saturday offers the BVM memoria", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 5, 30),
      "ordinary_time",
      null,
      [],
    );
    expect(alts.map((a) => a.choiceId)).toEqual(["feria", BVM_SATURDAY_SAINT_ID]);
    expect(alts.find((a) => a.isDefault)?.choiceId).toBe("feria");
    const bvm = alts.find((a) => a.choiceId === BVM_SATURDAY_SAINT_ID)!.celebration;
    expect(bvm.type).toBe("optional_memoria");
    expect(bvm.source).toBe("saint");
    expect(bvm.saintId).toBe(BVM_SATURDAY_SAINT_ID);
    expect(bvm.applicableCommons).toEqual(["bvm"]);
  });

  test("Saturday in Lent offers no BVM memoria", () => {
    const alts = enumerateCelebrationAlternatives(
      utcDate(2026, 3, 14),
      "lent",
      "lent_w3_sat",
      [],
    );
    expect(alts).toHaveLength(1);
    expect(alts[0]!.choiceId).toBe("feria");
  });
});

describe("resolveDay with a celebration choice (general calendar)", () => {
  beforeAll(() => ensureSanctoralCalendar());

  // 2026-01-20, ordinary Tuesday with TWO optional memorias in the GRC:
  // Fabian (martyrs+pastors) and Sebastian (martyrs).
  const date = utcDate(2026, 1, 20);

  test("default: an optional memoria wins", () => {
    const d = resolveDay(date, "general");
    expect(d.celebration.type).toBe("optional_memoria");
  });

  test("choosing the feria yields the ferial office", () => {
    const d = resolveDay(date, "general", { celebration: "feria" });
    expect(d.celebration.type).toBe("ordinary_ferial");
    expect(d.celebration.saintId).toBeUndefined();
  });

  test("choosing a specific memorial yields that saint", () => {
    const d = resolveDay(date, "general", { celebration: "saint:sebastian_martyr" });
    expect(d.celebration.type).toBe("optional_memoria");
    expect(d.celebration.saintId).toBe("sebastian_martyr");
  });

  test("a stale choice id silently falls back to the default", () => {
    const def = resolveDay(date, "general");
    const d = resolveDay(date, "general", { celebration: "saint:nobody_here" });
    expect(d.celebration).toEqual(def.celebration);
  });
});
