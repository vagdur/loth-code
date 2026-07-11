/**
 * Melody choices: chosen-ref selection in selectMelodyRef, path-keyed
 * choices in hydrateMelodies, and collectMelodyOptions enumeration.
 */

import { describe, expect, test } from "vitest";
import {
  collectMelodyOptions, hydrateMelodies, selectMelodyRef,
} from "../../src/data/melodyResolver.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { LiturgicalDay } from "../../src/types/calendar.js";
import type { MelodyRef, StoredMelody } from "../../src/types/melody.js";
import type { Antiphon, Melody } from "../../src/types/texts.js";

function makeDay(overrides: Partial<LiturgicalDay> = {}): LiturgicalDay {
  return {
    date: new Date("2026-10-06T00:00:00Z"),
    season: "ordinary_time",
    psalterWeek: 3,
    psalterDay: "Tuesday",
    readingYear: "I",
    sundayCycle: "A",
    ordinaryTimeWeek: 27,
    celebration: {
      type: "ordinary_ferial",
      source: "seasonal",
      applicableCommons: [],
      memoriaFullySuppressed: false,
      memoriaReducedToOptional: false,
      allowMemoriaAddendum: false,
      isTriduum: false,
    },
    evening: { hasFirstVespers: false },
    saturdayBvmPermitted: false,
    ...overrides,
  };
}

function stored(id: string, gabc: string, incipit?: string): StoredMelody {
  return {
    id,
    kind: "antiphon",
    mode: 1,
    parts: { antiphon: gabc },
    ...(incipit !== undefined ? { incipit } : {}),
    contentHash: id,
    source: {
      index: "i", pdf: "p", sourceCategory: "c",
      page: 1, sectionLabel: "s", filename: "f",
    },
  };
}

const STORE: Record<string, StoredMelody> = {
  "kln/x/default": stored("kln/x/default", "(c4) De(f)fault.(f)", "Default"),
  "kln/x/eller": stored("kln/x/eller", "(c4) El(f)ler.(f)", "Eller"),
  "kln/x/pask": stored("kln/x/pask", "(c4) På(f)sk.(f)", "Påsk"),
};

const repo = {
  getMelody: (id: string) => STORE[id],
} as unknown as DataRepository;

const day = makeDay();

const refs: MelodyRef[] = [
  { ref: "kln/x/pask", condition: { seasons: ["eastertide"] } },
  { ref: "kln/x/default" },
  { ref: "kln/x/eller", note: "eller" },
];

describe("selectMelodyRef with a chosen ref", () => {
  test("default: first matching ref", () => {
    expect(selectMelodyRef(refs, repo, day)?.stored.id).toBe("kln/x/default");
  });

  test("chosen alternative wins", () => {
    expect(selectMelodyRef(refs, repo, day, "kln/x/eller")?.stored.id).toBe("kln/x/eller");
  });

  test("index-disambiguated form", () => {
    expect(selectMelodyRef(refs, repo, day, "2:kln/x/eller")?.stored.id).toBe("kln/x/eller");
    // wrong index: falls back to the default first match
    expect(selectMelodyRef(refs, repo, day, "1:kln/x/eller")?.stored.id).toBe("kln/x/default");
  });

  test("a chosen ref whose condition does not match is refused", () => {
    expect(selectMelodyRef(refs, repo, day, "kln/x/pask")?.stored.id).toBe("kln/x/default");
  });

  test("a stale chosen id falls back to the default", () => {
    expect(selectMelodyRef(refs, repo, day, "kln/x/missing")?.stored.id).toBe("kln/x/default");
  });
});

describe("hydrateMelodies with path-keyed choices", () => {
  const antiphon: Antiphon = { text: "Text.", melodyRefs: refs };

  test("no choices: default melody", () => {
    const out = hydrateMelodies(antiphon, repo, day, { path: "lauds.benedictusAntiphon" });
    expect((out.melody as Melody).gabc).toContain("De(f)fault");
  });

  test("choice keyed by option path selects the alternative", () => {
    const out = hydrateMelodies(antiphon, repo, day, {
      path: "lauds.benedictusAntiphon",
      choices: { "lauds.benedictusAntiphon.melody": "kln/x/eller" },
    });
    expect((out.melody as Melody).gabc).toContain("El(f)ler");
  });

  test("nested carriers get extended paths", () => {
    const assignment = { psalmOrCanticleId: "psalm_1", antiphon };
    const out = hydrateMelodies(assignment, repo, day, {
      path: "lauds.psalmSlots[0]",
      choices: { "lauds.psalmSlots[0].antiphon.melody": "kln/x/eller" },
    });
    expect((out.antiphon.melody as Melody).gabc).toContain("El(f)ler");
  });
});

describe("collectMelodyOptions", () => {
  test("emits one option per carrier with ≥2 matching melodies", () => {
    const antiphon: Antiphon = { text: "Text.", melodyRefs: refs };
    const options = collectMelodyOptions(antiphon, repo, day, "lauds.benedictusAntiphon");
    expect(options).toHaveLength(1);
    const opt = options[0]!;
    expect(opt.id).toBe("lauds.benedictusAntiphon.melody");
    expect(opt.kind).toBe("melody");
    // The Eastertide-conditioned ref does not match an OT day.
    expect(opt.choices.map((c) => c.id)).toEqual(["kln/x/default", "kln/x/eller"]);
    expect(opt.defaultChoiceId).toBe("kln/x/default");
    expect(opt.choices[1]!.label).toContain("Eller");
  });

  test("a single matching melody yields no option", () => {
    const antiphon: Antiphon = {
      text: "Text.",
      melodyRefs: [{ ref: "kln/x/default" }],
    };
    expect(collectMelodyOptions(antiphon, repo, day, "p")).toHaveLength(0);
  });

  test("duplicate ref ids are disambiguated by index", () => {
    const antiphon: Antiphon = {
      text: "Text.",
      melodyRefs: [{ ref: "kln/x/default" }, { ref: "kln/x/default", note: "eller" }],
    };
    const options = collectMelodyOptions(antiphon, repo, day, "p");
    expect(options[0]!.choices.map((c) => c.id)).toEqual([
      "kln/x/default", "1:kln/x/default",
    ]);
  });
});
