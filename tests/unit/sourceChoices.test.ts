/**
 * office-spec §5.4 — ad-lib chain marking in the resolver and source-choice
 * application in resolveSource.
 */

import { describe, expect, test } from "vitest";
import { resolveSource, sourceChoiceId } from "../../src/assemblers/types.js";
import type { DataRepository } from "../../src/data/repository.js";
import {
  antiphonRef, hymnRef, intercessionsRef, shortReadingRef,
  type SlotContext,
} from "../../src/hours/resolver.js";
import type { Celebration } from "../../src/types/calendar.js";
import type { FallbackChain, SlotSourceDirect } from "../../src/types/hours.js";

function memoria(type: "obligatory_memoria" | "optional_memoria" = "obligatory_memoria"): Celebration {
  return {
    type,
    source: "saint",
    saintId: "st_x",
    applicableCommons: ["martyrs", "pastors"],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

function feast(): Celebration {
  return { ...memoria(), type: "feast" };
}

function ctxFor(celebration: Celebration): SlotContext {
  return {
    celebration,
    psalterWeek: 2,
    psalterDay: "Tuesday",
    season: "ordinary_time",
    hymnSeries: "seriesB",
  };
}

describe("§5.4 chains carry adLibFrom on memorias only", () => {
  const adLibSlots = [
    (c: SlotContext) => hymnRef(c, "lauds.hymns"),
    (c: SlotContext) => shortReadingRef(c, "lauds.shortReading"),
    (c: SlotContext) => intercessionsRef(c, "lauds.intercessions"),
  ];

  test("memoria hymn/reading/intercessions chains are marked after the saint head", () => {
    for (const make of adLibSlots) {
      const src = make(ctxFor(memoria())) as FallbackChain;
      expect(src.kind).toBe("fallback_chain");
      expect(src.adLibFrom).toBe(1);
      expect(src.sources[0]!.kind).toBe("saint");
    }
  });

  test("memoria canticle antiphon is strict proper → common only", () => {
    const src = antiphonRef(
      ctxFor(memoria()),
      "lauds.benedictusAntiphon",
      "lauds.benedictusAntiphon",
    ) as FallbackChain;
    expect(src.kind).toBe("fallback_chain");
    expect(src.adLibFrom).toBeUndefined();
    expect(src.sources.map((s) => s.kind)).toEqual(["saint", "common", "common"]);
  });

  test("feast chains stay strict", () => {
    const slots = [
      ...adLibSlots,
      (c: SlotContext) => antiphonRef(c, "lauds.benedictusAntiphon", "lauds.benedictusAntiphon"),
    ];
    for (const make of slots) {
      const src = make(ctxFor(feast())) as FallbackChain;
      expect(src.kind).toBe("fallback_chain");
      expect(src.adLibFrom).toBeUndefined();
    }
  });
});

describe("resolveSource with a source choice", () => {
  // Stub repository: the saint has nothing, both commons and the psalter
  // yield distinguishable values.
  const values: Record<string, string> = {
    "common:martyrs:0": "hymn-from-martyrs",
    "common:pastors:0": "hymn-from-pastors",
    "psalter": "hymn-from-psalter",
  };
  const repoWithoutSaint = {
    resolve: (s: SlotSourceDirect) => values[sourceChoiceId(s)],
  } as unknown as DataRepository;
  const repoWithSaint = {
    resolve: (s: SlotSourceDirect) =>
      s.kind === "saint" ? "hymn-from-saint" : values[sourceChoiceId(s)],
  } as unknown as DataRepository;

  const chain = hymnRef(ctxFor(memoria()), "lauds.hymns");
  const opts = (choice: string) => ({
    choices: { "lauds.hymn.source": choice },
    optionPath: "lauds.hymn",
  });

  test("default (no choice): first non-null in order", () => {
    expect(resolveSource(chain, repoWithoutSaint)).toBe("hymn-from-martyrs");
  });

  test("each ad-lib choice selects its source", () => {
    expect(resolveSource(chain, repoWithoutSaint, undefined, opts("common:pastors:0")))
      .toBe("hymn-from-pastors");
    expect(resolveSource(chain, repoWithoutSaint, undefined, opts("psalter")))
      .toBe("hymn-from-psalter");
    expect(resolveSource(chain, repoWithoutSaint, undefined, opts("common:martyrs:0")))
      .toBe("hymn-from-martyrs");
  });

  test("a proper text always wins over the choice (§5.4)", () => {
    expect(resolveSource(chain, repoWithSaint, undefined, opts("psalter")))
      .toBe("hymn-from-saint");
  });

  test("a stale choice falls back to the default tail walk", () => {
    expect(resolveSource(chain, repoWithoutSaint, undefined, opts("common:virgins:0")))
      .toBe("hymn-from-martyrs");
  });

  test("choices without adLibFrom marking are ignored (strict chains)", () => {
    const strict = hymnRef(ctxFor(feast()), "lauds.hymns");
    expect(resolveSource(strict, repoWithoutSaint, undefined, opts("psalter")))
      .toBe("hymn-from-martyrs");
  });
});
