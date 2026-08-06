/**
 * Per-day options end-to-end against the data tree: enumeration,
 * application, and the default round-trip guarantee (applying every
 * option's default choice is byte-identical to applying no choices).
 */

import { beforeAll, describe, expect, test } from "vitest";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { resolveSource } from "../../src/assemblers/types.js";
import { resolveDay } from "../../src/calendar/index.js";
import { loadSanctoralRegistry } from "../../src/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../../src/calendar/saints.js";
import { utcDate } from "../../src/calendar/computus.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import { buildDay } from "../../src/hours/index.js";
import { defaultContext } from "../../src/calendar/index.js";
import { enumerateDayOptions } from "../../src/options/enumerate.js";
import { daySlots, slotPath } from "../../src/options/slotTable.js";
import { dataRoot } from "../helpers/paths.js";
import type { Antiphon, Melody } from "../../src/types/texts.js";
import type { DayChoices } from "../../src/types/options.js";

const locale = "en";
let repo: DataRepository;
const ctx = defaultContext("general");

beforeAll(async () => {
  const registry = await loadSanctoralRegistry(dataRoot, locale);
  initSanctoralRegistry(registry);
  repo = await loadRepository(dataRoot, locale);
});

/** First date in 2026 whose enumeration contains a saint celebration choice. */
function findMemoriaDay(): Date {
  for (let offset = 0; offset < 365; offset++) {
    const date = utcDate(2026, 1, 10 + offset);
    const day = resolveDay(date, ctx.calendarId);
    if (
      day.celebration.source === "saint" &&
      day.celebration.type === "optional_memoria"
    ) {
      return date;
    }
  }
  throw new Error("no optional memoria found in 2026");
}

function defaultsOf(date: Date): DayChoices {
  const { options } = enumerateDayOptions(date, ctx, repo);
  return Object.fromEntries(options.map((o) => [o.id, o.defaultChoiceId]));
}

describe("enumerateDayOptions", () => {
  test("a slot with two settings exposes them as a melody option", () => {
    const date = utcDate(2026, 5, 10); // 6th Sunday of Easter, Week II
    const { options } = enumerateDayOptions(date, ctx, repo);
    const melodyOption = options.find(
      (o) => o.id === "lauds.psalmSlots[0].antiphon.melody",
    );
    expect(melodyOption).toBeDefined();
    expect(melodyOption!.choices.length).toBeGreaterThanOrEqual(2);

    // Applying a non-default melody choice changes the hydrated melody.
    const day = resolveDay(date, ctx.calendarId);
    const abs = buildDay(day, ctx);
    // The slot resolves to a psalm assignment; the antiphon hangs off it, which
    // is why the option path descends one level further than the slot itself.
    const resolveWith = (choices?: DayChoices) =>
      (resolveSource(abs.lauds.psalmSlots[0]!.assignmentRef, repo, day, {
        ...(choices ? { choices } : {}),
        optionPath: "lauds.psalmSlots[0]",
      }) as { antiphon: Antiphon }).antiphon;
    const defaultGabc = (resolveWith().melody as Melody).gabc;
    const alt = melodyOption!.choices.find((c) => c.id !== melodyOption!.defaultChoiceId)!;
    const altGabc = (
      resolveWith({ "lauds.psalmSlots[0].antiphon.melody": alt.id }).melody as Melody
    ).gabc;
    expect(altGabc).toBeDefined();
    expect(altGabc).not.toBe(defaultGabc);
  });

  test("an optional memoria day offers the celebration choice and applies it", () => {
    const date = findMemoriaDay();
    const { options } = enumerateDayOptions(date, ctx, repo);
    const celebration = options.find((o) => o.id === "celebration");
    expect(celebration).toBeDefined();
    expect(celebration!.choices.map((c) => c.id)).toContain("feria");
    expect(celebration!.defaultChoiceId).toMatch(/^saint:/);

    const feriaDay = resolveDay(date, ctx.calendarId, { celebration: "feria" });
    expect(feriaDay.celebration.type).toBe("ordinary_ferial");

    // Choosing the feria removes the saint's texts from the office.
    const assembler = new PlainTextAssembler();
    const saintText = assembler.assembleDay(
      buildDay(resolveDay(date, ctx.calendarId), ctx), repo,
    );
    const feriaText = assembler.assembleDay(buildDay(feriaDay, ctx), repo);
    expect(feriaText).not.toBe(saintText);
  });

  test("a memoria day exposes at least one ad-lib part-source option somewhere in 2026", () => {
    // Scan memoria days until one yields a part_source option (a §5.4 slot
    // with no proper text where two or more tail sources resolve).
    let found;
    for (let offset = 0; offset < 365 && !found; offset++) {
      const date = utcDate(2026, 1, 10 + offset);
      const day = resolveDay(date, ctx.calendarId);
      if (day.celebration.source !== "saint") continue;
      if (!["obligatory_memoria", "optional_memoria"].includes(day.celebration.type)) continue;
      const { options } = enumerateDayOptions(date, ctx, repo);
      const src = options.find((o) => o.kind === "part_source");
      if (src) found = { date, option: src, day };
    }
    expect(found).toBeDefined();
    const { option, day } = found!;
    expect(option.choices.length).toBeGreaterThanOrEqual(2);

    // Applying each choice resolves the slot from a different source.
    const abs = buildDay(day, ctx);
    const optionPath = option.id.replace(/\.source$/, "");
    const slot = daySlots(abs).find(
      (s) => slotPath(s.hourKey, s.slotKey) === optionPath,
    );
    expect(slot).toBeDefined();
    const values = option.choices.map((c) =>
      JSON.stringify(
        resolveSource(slot!.source, repo, undefined, {
          choices: { [option.id]: c.id },
          optionPath,
        }),
      ),
    );
    expect(new Set(values).size).toBeGreaterThanOrEqual(2);
  });

  test("daytime psalmody option is enumerated with the context default", () => {
    const date = utcDate(2026, 4, 5);
    const { options } = enumerateDayOptions(date, ctx, repo);
    const psalmody = options.find((o) => o.id === "sext.psalmody");
    expect(psalmody).toBeDefined();
    expect(psalmody!.defaultChoiceId).toBe("current");
    expect(psalmody!.choices.map((c) => c.id)).toEqual(["current", "complementary"]);
  });

  test("round-trip: applying every default choice is byte-identical to no choices", () => {
    const assembler = new PlainTextAssembler();
    for (const date of [utcDate(2026, 4, 5), findMemoriaDay(), utcDate(2026, 5, 30)]) {
      const plain = assembler.assembleDay(
        buildDay(resolveDay(date, ctx.calendarId), ctx), repo,
      );
      const defaults = defaultsOf(date);
      const withDefaults = assembler.assembleDay(
        buildDay(resolveDay(date, ctx.calendarId, defaults), ctx, defaults),
        repo,
        defaults,
      );
      expect(withDefaults).toBe(plain);
    }
  });

  test("effectiveChoices reflects valid choices and falls back for stale ones", () => {
    const date = findMemoriaDay();
    const { options, effectiveChoices } = enumerateDayOptions(date, ctx, repo, {
      celebration: "feria",
      "sext.psalmody": "bogus-value",
    });
    expect(effectiveChoices["celebration"]).toBe("feria");
    expect(effectiveChoices["sext.psalmody"]).toBe("current");
    for (const o of options) {
      expect(o.choices.map((c) => c.id)).toContain(effectiveChoices[o.id]);
    }
  });
});
