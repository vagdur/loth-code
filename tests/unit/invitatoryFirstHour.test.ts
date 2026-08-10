/**
 * office-spec §3.1 / GILH 34–36 — Invitatory prefixes the first Hour of the day.
 */

import { describe, expect, test } from "vitest";
import { resolveDay } from "../../src/calendar/index.js";
import { buildLauds } from "../../src/hours/buildLauds.js";
import { buildOfficeOfReadings } from "../../src/hours/buildOfficeOfReadings.js";
import { PlainTextAssembler } from "../../src/assemblers/plainText.js";
import { loadRepository } from "../../src/data/repositoryNode.js";
import type { AssemblyContext } from "../../src/types/calendar.js";
import { dataRoot } from "../helpers/paths.js";

function sampleDay() {
  return resolveDay(new Date("2026-05-10T00:00:00Z"), "general");
}

function ctx(overrides: Partial<AssemblyContext> = {}): AssemblyContext {
  return {
    daytimeHoursSaid: ["sext"],
    oorIsFirstHour: false,
    laudsFollowsOorDirectly: false,
    oorSaidAtNight: false,
    complineFollows: "after_ferial_vespers",
    calendarId: "general",
    ...overrides,
  };
}

describe("Invitatory on the first Hour", () => {
  test("OoR receives the Invitatory when it begins the day", () => {
    const oor = buildOfficeOfReadings(sampleDay(), ctx({ oorIsFirstHour: true }));
    expect(oor.isFirstHour).toBe(true);
    expect(oor.invitatory?.kind).toBe("invitatory");
    expect(oor.invitatory?.psalmRef).toMatchObject({ kind: "psalm", id: "psalm_94" });
  });

  test("OoR omits the Invitatory when it is not the first Hour", () => {
    const oor = buildOfficeOfReadings(sampleDay(), ctx({ oorIsFirstHour: false }));
    expect(oor.isFirstHour).toBe(false);
    expect(oor.invitatory).toBeUndefined();
  });

  test("Lauds receives the Invitatory when OoR is not first", () => {
    const lauds = buildLauds(sampleDay(), ctx({ oorIsFirstHour: false }));
    expect(lauds.invitatory?.kind).toBe("invitatory");
    expect(lauds.suppressIntroVerse).toBe(true);
  });

  test("Lauds omits Invitatory when OoR began the day, but suppresses intro when following directly", () => {
    const lauds = buildLauds(sampleDay(), ctx({
      oorIsFirstHour: true,
      laudsFollowsOorDirectly: true,
    }));
    expect(lauds.invitatory).toBeUndefined();
    expect(lauds.suppressIntroVerse).toBe(true);
  });

  test("Lauds keeps intro verse when said separately after OoR", () => {
    const lauds = buildLauds(sampleDay(), ctx({
      oorIsFirstHour: true,
      laudsFollowsOorDirectly: false,
    }));
    expect(lauds.invitatory).toBeUndefined();
    expect(lauds.suppressIntroVerse).toBe(false);
  });

  test("plain assembler emits invitatory verse and psalm antiphon on Lauds when first", async () => {
    const repo = await loadRepository(dataRoot, "en");
    const lauds = buildLauds(sampleDay(), ctx({ oorIsFirstHour: false }));
    const text = new PlainTextAssembler().assembleLauds(lauds, repo);

    expect(text).toMatch(/Lord, open our lips/i);
    expect(text).toMatch(/Week 2 Sunday invitatory/);
    expect(text).toMatch(/psalm_94/);
    // Intro verse of Lauds must not appear when the Invitatory precedes (GILH 41).
    expect(text).not.toMatch(/O God, come to our aid/i);
  });

  test("plain assembler emits invitatory on OoR when first, not the intro verse", async () => {
    const repo = await loadRepository(dataRoot, "en");
    const oor = buildOfficeOfReadings(sampleDay(), ctx({ oorIsFirstHour: true }));
    const text = new PlainTextAssembler().assembleOfficeOfReadings(oor, repo);

    expect(text).toMatch(/Lord, open our lips/i);
    expect(text).toMatch(/Week 2 Sunday invitatory/);
    expect(text).toMatch(/psalm_94/);
    expect(text).not.toMatch(/O God, come to our aid/i);
  });
});
