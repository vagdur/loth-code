/**
 * office-spec §5.4–§5.7, §6 (concluding prayers), §7 (antiphons / fallbacks),
 * §3.5 (Compline Marian antiphon) — slot resolver builds correct source chains
 * without loading repository text.
 */

import { describe, expect, test } from "vitest";
import type { Celebration } from "../../src/types/calendar.js";
import type { FallbackChain, SlotSource, SlotSourceDirect } from "../../src/types/hours.js";
import {
  antiphonRef,
  biblicalReadingRef,
  concludingPrayerRef,
  hymnRef,
  intercessionsRef,
  marianAntiphonRef,
  patristicReadingRef,
  shortReadingRef,
  type SlotContext,
} from "../../src/hours/resolver.js";

function flattenSources(src: SlotSource): SlotSourceDirect[] {
  if (src.kind === "fallback_chain") {
    return (src as FallbackChain).sources.flatMap(flattenSources);
  }
  return [src];
}

function seasonalFerialCelebration(): Celebration {
  return {
    type: "ordinary_ferial",
    source: "seasonal",
    seasonalKey: "ot_w5_mon",
    applicableCommons: [],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

function ordinaryFerialNoKey(): Celebration {
  return {
    type: "ordinary_ferial",
    source: "seasonal",
    applicableCommons: [],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

function saintSolemnity(): Celebration {
  return {
    type: "solemnity",
    source: "saint",
    saintId: "st_joseph",
    applicableCommons: ["pastors"],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

function obligatoryMemoria(): Celebration {
  return {
    type: "obligatory_memoria",
    source: "saint",
    saintId: "st_francis",
    seasonalKey: "ot_w3_fri",
    applicableCommons: ["pastors"],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

function baseCtx(celebration: Celebration): SlotContext {
  return {
    celebration,
    psalterWeek: 2,
    psalterDay: "Monday",
    season: "ordinary_time",
    hymnSeries: "seriesB",
  };
}

describe("concludingPrayerRef", () => {
  test("office-spec §6 — Compline concluding prayer always from psalter", () => {
    const ctx = baseCtx(saintSolemnity());
    const src = concludingPrayerRef(ctx, "compline");
    expect(src).toEqual({
      kind: "psalter",
      week: 2,
      day: "Monday",
      field: "compline.concludingPrayer",
    });
  });

  test("office-spec §6 — Lauds/Vespers ordinary ferial: psalter only", () => {
    const ctx = baseCtx(ordinaryFerialNoKey());
    const lauds = concludingPrayerRef(ctx, "lauds");
    expect(lauds).toEqual({
      kind: "psalter",
      week: 2,
      day: "Monday",
      field: "lauds.concludingPrayer",
    });
  });

  test("office-spec §5.4 / §6 — memoria: saint prayer only for Lauds", () => {
    const ctx = baseCtx(obligatoryMemoria());
    const lauds = concludingPrayerRef(ctx, "lauds");
    expect(lauds).toEqual({
      kind: "saint",
      id: "st_francis",
      field: "lauds.concludingPrayer",
    });
  });

  test("office-spec §6 — seasonal ferial: seasonal then psalter", () => {
    const ctx = baseCtx(seasonalFerialCelebration());
    const lauds = concludingPrayerRef(ctx, "lauds");
    expect(flattenSources(lauds).map((s) => s.kind)).toEqual(["seasonal", "psalter"]);
  });

  test("office-spec §6 — OoR with saint: saint then commons, no psalter fallback", () => {
    const ctx = baseCtx(saintSolemnity());
    const oor = concludingPrayerRef(ctx, "oor");
    const kinds = flattenSources(oor).map((s) => s.kind);
    expect(kinds).toEqual(["saint", "common"]);
  });

  test("office-spec §6 — OoR seasonal key only", () => {
    const ctx = baseCtx(seasonalFerialCelebration());
    const oor = concludingPrayerRef(ctx, "oor");
    expect(oor).toEqual({
      kind: "seasonal",
      key: "ot_w5_mon",
      field: "officeOfReadings.concludingPrayer",
    });
  });
});

describe("hymnRef", () => {
  test("psalter only when no seasonal key and seasonal source", () => {
    const ctx = baseCtx(ordinaryFerialNoKey());
    const src = hymnRef(ctx, "lauds.hymns");
    expect(src).toEqual({
      kind: "psalter",
      week: 2,
      day: "Monday",
      field: "lauds.hymns.seriesB",
    });
  });

  test("seasonal then psalter when seasonalKey set", () => {
    const ctx = baseCtx(seasonalFerialCelebration());
    const src = hymnRef(ctx, "vespers.hymns");
    expect(flattenSources(src).map((s) => s.kind)).toEqual(["seasonal", "psalter"]);
  });

  test("saint hour field then commons then psalter for saint solemnity", () => {
    const ctx = baseCtx(saintSolemnity());
    const src = hymnRef(ctx, "lauds.hymns");
    const flat = flattenSources(src);
    // Propers carry a single hymn per hour; only the psalter has the series set.
    expect(flat[0]).toMatchObject({ kind: "saint", id: "st_joseph", field: "lauds.hymn" });
    expect(flat[1]).toMatchObject({ kind: "common", type: "pastors", field: "lauds.hymn" });
    expect(flat[flat.length - 1]).toMatchObject({
      kind: "psalter",
      field: "lauds.hymns.seriesB",
    });
  });
});

describe("shortReadingRef and antiphonRef and intercessionsRef", () => {
  test("shortReadingRef: memoria chain includes seasonal when present", () => {
    const ctx = baseCtx(obligatoryMemoria());
    const src = shortReadingRef(ctx, "lauds.shortReading");
    const kinds = flattenSources(src).map((s) => s.kind);
    expect(kinds).toEqual(["saint", "common", "seasonal", "psalter"]);
  });

  test("antiphonRef: memoria uses psalterField path last", () => {
    const ctx = baseCtx(obligatoryMemoria());
    const src = antiphonRef(ctx, "lauds.benedictusAntiphon", "lauds.benedictusAntiphonPsalter");
    const last = flattenSources(src).at(-1);
    expect(last).toMatchObject({
      kind: "psalter",
      field: "lauds.benedictusAntiphonPsalter",
    });
  });

  test("intercessionsRef: saint solemnity ends at psalter", () => {
    const ctx = baseCtx(saintSolemnity());
    const src = intercessionsRef(ctx, "vespers.intercessions");
    expect(flattenSources(src).map((s) => s.kind)).toEqual(["saint", "common", "psalter"]);
  });
});

describe("biblicalReadingRef", () => {
  test("office-spec §5 / §12 — saint: saint then commons only", () => {
    const ctx = baseCtx(saintSolemnity());
    const src = biblicalReadingRef(ctx, "I");
    expect(flattenSources(src).map((s) => s.kind)).toEqual(["saint", "common"]);
  });

  test("seasonal: two-year field then single-year", () => {
    const ctx = baseCtx(seasonalFerialCelebration());
    const src = biblicalReadingRef(ctx, "II");
    expect(src).toMatchObject({ kind: "fallback_chain" });
    const flat = flattenSources(src);
    expect(flat[0]).toMatchObject({
      kind: "seasonal",
      key: "ot_w5_mon",
      field: "officeOfReadings.biblicalReadingYr2",
    });
    expect(flat[1]).toMatchObject({
      kind: "seasonal",
      key: "ot_w5_mon",
      field: "officeOfReadings.biblicalReading",
    });
  });

  test("ordinary ferial without key: placeholder seasonal for assembler", () => {
    const ctx = baseCtx(ordinaryFerialNoKey());
    const src = biblicalReadingRef(ctx, "I");
    expect(src).toEqual({
      kind: "seasonal",
      key: "",
      field: "officeOfReadings.biblicalReading",
    });
  });
});

describe("patristicReadingRef", () => {
  test("office-spec §5.4 — memoria without seasonalKey: saint, commons only", () => {
    const mem: Celebration = {
      ...obligatoryMemoria(),
      seasonalKey: undefined,
    };
    const ctx = baseCtx(mem);
    const src = patristicReadingRef(ctx, "I");
    expect(flattenSources(src).map((s) => s.kind)).toEqual(["saint", "common"]);
  });

  test("office-spec §5.4 — memoria with seasonalKey adds patristic fallback", () => {
    const ctx = baseCtx(obligatoryMemoria());
    const src = patristicReadingRef(ctx, "I");
    const kinds = flattenSources(src).map((s) => s.kind);
    expect(kinds).toEqual(["saint", "common", "seasonal"]);
  });

  test("solemnity: saint hagiographical then commons", () => {
    const ctx = baseCtx(saintSolemnity());
    const src = patristicReadingRef(ctx, "II");
    expect(flattenSources(src).map((s) => s.kind)).toEqual(["saint", "common"]);
  });

  test("seasonal non-memoria: year fields then single", () => {
    const ctx = baseCtx(seasonalFerialCelebration());
    const src = patristicReadingRef(ctx, "I");
    const flat = flattenSources(src);
    expect(flat.map((s) => s.kind)).toEqual(["seasonal", "seasonal"]);
  });

  test("ordinary ferial: psalter patristic slot", () => {
    const ctx = baseCtx(ordinaryFerialNoKey());
    const src = patristicReadingRef(ctx, "I");
    expect(src).toMatchObject({
      kind: "psalter",
      field: "officeOfReadings.patristicReading",
    });
  });
});

describe("marianAntiphonRef", () => {
  test("office-spec §3.5 — Eastertide uses Regina caeli field id", () => {
    const src = marianAntiphonRef("eastertide");
    expect(src).toEqual({ kind: "fixed", field: "marianAntiphons.eastertide" });
  });

  test("Advent and Christmas use Advent-through-Candlemas field", () => {
    expect(marianAntiphonRef("advent")).toEqual({
      kind: "fixed",
      field: "marianAntiphons.adventThroughFeb2",
    });
    expect(marianAntiphonRef("christmas")).toEqual({
      kind: "fixed",
      field: "marianAntiphons.adventThroughFeb2",
    });
  });

  test("Ordinary Time and Lent map to ordinary-time Marian field", () => {
    expect(marianAntiphonRef("ordinary_time").field).toBe("marianAntiphons.ordinaryTime");
    expect(marianAntiphonRef("lent").field).toBe("marianAntiphons.ordinaryTime");
  });
});
