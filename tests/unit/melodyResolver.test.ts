/**
 * Melody reference resolution — condition matching, first-match-wins
 * ordering, alias lookup, and hydration into inline melody fields.
 */

import { describe, expect, test } from "vitest";
import {
  hydrateMelodies, matchesCondition, resolveAllMelodies, selectMelodyRef,
} from "../../src/data/melodyResolver.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { LiturgicalDay } from "../../src/types/calendar.js";
import type { StoredMelody } from "../../src/types/melody.js";
import type { Antiphon, ShortResponsory } from "../../src/types/texts.js";

function makeDay(overrides: Partial<LiturgicalDay> = {}): LiturgicalDay {
  return {
    date: new Date("2026-05-10T00:00:00Z"),
    season: "eastertide",
    psalterWeek: 2,
    psalterDay: "Sunday",
    readingYear: "I",
    sundayCycle: "A",
    ordinaryTimeWeek: 0,
    celebration: {
      type: "sunday",
      source: "seasonal",
      seasonalKey: "easter_w6_sun",
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

const STORE: Record<string, StoredMelody> = {
  "kln/a/ot-antifon": {
    id: "kln/a/ot-antifon",
    kind: "antiphon",
    mode: 6,
    parts: { antiphon: "(c4) Or(f)di(g)na(f)rie.(f)", psalmTone: "(c4) (f) (gR)" },
    contentHash: "aaaa",
    aliases: ["kln/b/ot-antifon-kopia"],
    source: {
      index: "i", pdf: "p", sourceCategory: "c",
      page: 1, sectionLabel: "Antifon 1", filename: "f",
    },
  },
  "kln/a/pask-antifon": {
    id: "kln/a/pask-antifon",
    kind: "antiphon",
    mode: 8,
    parts: {
      antiphon: "(c4) På(f)sk.(f)",
      antiphonPaschal: "(c4) På(f)sk.(f) Hal(g)le(f)lu(g)ja.(f)",
      psalmTone: "(c4) (g) (hR)",
    },
    contentHash: "bbbb",
    source: {
      index: "i", pdf: "p", sourceCategory: "c",
      page: 1, sectionLabel: "Antifon 1", filename: "f",
    },
  },
  "kln/a/kort-resp": {
    id: "kln/a/kort-resp",
    kind: "short_responsory",
    parts: {
      responsory: "(c4) Förs(f)ta.(f)",
      responsorySecond: "(c4) And(f)ra.(f)",
      versicle: "(c4) Vers.(f)",
      gloria: "(c4) Ä(f)ra.(f)",
    },
    contentHash: "cccc",
    source: {
      index: "i", pdf: "p", sourceCategory: "c",
      page: 1, sectionLabel: "Kort responsorium", filename: "f",
    },
  },
};

const repo = {
  getMelody(id: string): StoredMelody | undefined {
    if (STORE[id]) return STORE[id];
    for (const m of Object.values(STORE)) {
      if (m.aliases?.includes(id)) return m;
    }
    return undefined;
  },
} as unknown as DataRepository;

describe("matchesCondition", () => {
  const day = makeDay();

  test("absent condition always matches", () => {
    expect(matchesCondition(undefined, day)).toBe(true);
  });

  test("seasons", () => {
    expect(matchesCondition({ seasons: ["eastertide"] }, day)).toBe(true);
    expect(matchesCondition({ seasons: ["lent", "advent"] }, day)).toBe(false);
  });

  test("dayClasses", () => {
    expect(matchesCondition({ dayClasses: ["sunday"] }, day)).toBe(true);
    expect(matchesCondition({ dayClasses: ["solemnity"] }, day)).toBe(false);
  });

  test("sundayCycles", () => {
    expect(matchesCondition({ sundayCycles: ["A"] }, day)).toBe(true);
    expect(matchesCondition({ sundayCycles: ["B", "C"] }, day)).toBe(false);
  });

  test("dateRange, plain", () => {
    expect(matchesCondition({ dateRange: { from: "05-01", to: "05-31" } }, day)).toBe(true);
    expect(matchesCondition({ dateRange: { from: "06-01", to: "06-30" } }, day)).toBe(false);
  });

  test("dateRange wrapping the year end", () => {
    const dec20 = makeDay({ date: new Date("2025-12-20T00:00:00Z") });
    const jan03 = makeDay({ date: new Date("2026-01-03T00:00:00Z") });
    const cond = { dateRange: { from: "12-17", to: "01-05" } };
    expect(matchesCondition(cond, dec20)).toBe(true);
    expect(matchesCondition(cond, jan03)).toBe(true);
    expect(matchesCondition(cond, makeDay())).toBe(false);
  });

  test("weekdays", () => {
    expect(matchesCondition({ weekdays: ["Sunday"] }, day)).toBe(true);
    expect(matchesCondition({ weekdays: ["Monday", "Friday"] }, day)).toBe(false);
    const monday = makeDay({ psalterDay: "Monday" });
    expect(matchesCondition({ weekdays: ["Monday"] }, monday)).toBe(true);
  });

  test("fields combine with AND", () => {
    expect(
      matchesCondition({ seasons: ["eastertide"], sundayCycles: ["B"] }, day),
    ).toBe(false);
  });
});

describe("selectMelodyRef / resolveAllMelodies", () => {
  test("first matching ref wins; unconditioned default last", () => {
    const refs = [
      { ref: "kln/a/pask-antifon", condition: { seasons: ["eastertide" as const] } },
      { ref: "kln/a/ot-antifon" },
    ];
    const easter = selectMelodyRef(refs, repo, makeDay());
    expect(easter?.stored.id).toBe("kln/a/pask-antifon");

    const ordinary = selectMelodyRef(refs, repo, makeDay({ season: "ordinary_time" }));
    expect(ordinary?.stored.id).toBe("kln/a/ot-antifon");
  });

  test("alias ids resolve to the canonical melody", () => {
    const found = selectMelodyRef([{ ref: "kln/b/ot-antifon-kopia" }], repo, makeDay());
    expect(found?.stored.id).toBe("kln/a/ot-antifon");
  });

  test("dangling ref is skipped in favour of a later resolvable one", () => {
    const refs = [{ ref: "kln/finns/inte" }, { ref: "kln/a/ot-antifon" }];
    expect(selectMelodyRef(refs, repo, makeDay())?.stored.id).toBe("kln/a/ot-antifon");
  });

  test("resolveAllMelodies returns every matching alternative in order", () => {
    const refs = [
      { ref: "kln/a/ot-antifon" },
      { ref: "kln/a/pask-antifon", note: "eller" },
    ];
    const all = resolveAllMelodies(refs, repo, makeDay());
    expect(all.map((m) => m.id)).toEqual(["kln/a/ot-antifon", "kln/a/pask-antifon"]);
  });
});

describe("hydrateMelodies", () => {
  test("antiphon: melody and psalmTone are filled from the store", () => {
    const antiphon: Antiphon = {
      text: "Ordinarie.",
      melodyRefs: [{ ref: "kln/a/ot-antifon" }],
    };
    const hydrated = hydrateMelodies(antiphon, repo, makeDay());
    expect(hydrated.melody).toEqual({ mode: 6, gabc: "(c4) Or(f)di(g)na(f)rie.(f)" });
    expect(hydrated.psalmTone).toBe("(c4) (f) (gR)");
    // Original untouched.
    expect(antiphon.melody).toBeUndefined();
  });

  test("paschal antiphon body is used during Eastertide", () => {
    const antiphon: Antiphon = {
      text: "Påsk.",
      melodyRefs: [{ ref: "kln/a/pask-antifon" }],
    };
    const easter = hydrateMelodies(antiphon, repo, makeDay());
    expect(easter.melody?.gabc).toContain("Hal(g)le(f)lu(g)ja");
    const ot = hydrateMelodies(antiphon, repo, makeDay({ season: "ordinary_time" }));
    expect(ot.melody?.gabc).toBe("(c4) På(f)sk.(f)");
  });

  test("short responsory: four-part melody", () => {
    const resp: ShortResponsory = {
      text: "Första.",
      versicle: "Vers.",
      melodyRefs: [{ ref: "kln/a/kort-resp" }],
    };
    const hydrated = hydrateMelodies(resp, repo, makeDay());
    expect(hydrated.melody).toEqual({
      responsory: "(c4) Förs(f)ta.(f)",
      responsorySecond: "(c4) And(f)ra.(f)",
      versicle: "(c4) Vers.(f)",
      gloria: "(c4) Ä(f)ra.(f)",
    });
  });

  test("conditioned variant overrides the sung text; default leaves it alone", () => {
    const store: StoredMelody = {
      id: "kln/a/pt-variant",
      kind: "antiphon",
      parts: { antiphon: "(c4) Sam(g)ple(f) va(d)ri(f)ant.(e)" },
      text: "Sample variant antiphon.",
      contentHash: "dddd",
      source: {
        index: "i", pdf: "p", sourceCategory: "c",
        page: 1, sectionLabel: "Antifon 1", filename: "f",
      },
    };
    const repoWithVariant = {
      getMelody: (id: string) =>
        id === "kln/a/pt-variant" ? store : (repo as unknown as { getMelody(i: string): StoredMelody | undefined }).getMelody(id),
    } as unknown as DataRepository;

    const antiphon: Antiphon = {
      text: "Sample default antiphon.",
      melodyRefs: [
        { ref: "kln/a/pt-variant", condition: { seasons: ["eastertide"] } },
        { ref: "kln/a/ot-antifon" },
      ],
    };
    const easter = hydrateMelodies(antiphon, repoWithVariant, makeDay());
    expect(easter.text).toBe("Sample variant antiphon.");
    const ot = hydrateMelodies(antiphon, repoWithVariant, makeDay({ season: "ordinary_time" }));
    expect(ot.text).toBe("Sample default antiphon.");
  });

  test("dangling ref keeps the inline melody fallback", () => {
    const antiphon: Antiphon = {
      text: "Handskriven.",
      melody: { gabc: "(c4) Hand(f)skri(g)ven.(f)" },
      melodyRefs: [{ ref: "kln/finns/inte" }],
    };
    const hydrated = hydrateMelodies(antiphon, repo, makeDay());
    expect(hydrated.melody?.gabc).toBe("(c4) Hand(f)skri(g)ven.(f)");
  });

  test("nested structures are walked", () => {
    const nested = {
      psalmAssignments: [
        {
          psalmOrCanticleId: "psalm_1",
          antiphon: { text: "x", melodyRefs: [{ ref: "kln/a/ot-antifon" }] },
        },
      ],
    };
    const hydrated = hydrateMelodies(nested, repo, makeDay());
    expect(hydrated.psalmAssignments[0]?.antiphon.melody?.mode).toBe(6);
  });
});
