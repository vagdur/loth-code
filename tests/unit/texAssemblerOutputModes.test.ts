/**
 * TexAssembler output modes: plain (no scores) and scored (scores only).
 */

import { expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";

function countMatches(tex: string, pattern: RegExp): number {
  return [...tex.matchAll(pattern)].length;
}

test("plain mode emits plain macros and no GABC scores", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler({ outputMode: "plain" });
  const tex = assembler.assembleLauds(day.lauds, repo);

  expect(tex).not.toContain("\\lothScore{");
  expect(tex).toMatch(/\\antiphon\{/);
  expect(tex).toMatch(/\\hymn\{/);
  expect(tex).toMatch(/\\shortResponsory\{/);
  expect(tex).toMatch(/\\lordsPrayer\{/);
  expect(tex).toMatch(/\\dismissal\{/);
  expect(tex).toContain("\\psalmText{");
  expect(tex).toContain("\\gospelCanticle{");
  expect(tex).toMatch(/\\melodyRubric\{Mode /);
  expect(assembler.getGabcFiles().size).toBe(0);
});

test("scored mode emits scores only for sung slots", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler({ outputMode: "scored" });
  const tex = assembler.assembleLauds(day.lauds, repo);

  expect(tex).toContain("\\lothScore{");
  expect(tex).not.toMatch(/\\antiphon\{/);
  expect(tex).not.toMatch(/\\hymn\{/);
  expect(tex).not.toMatch(/\\shortResponsory\{/);
  expect(tex).not.toMatch(/\\lordsPrayer\{/);
  expect(tex).not.toMatch(/\\dismissal\{/);
  expect(tex).not.toContain("\\psalmText{");
  expect(tex).not.toContain("\\gospelCanticle{");
  expect(tex).toContain("\\hourHeading{");
  expect(tex).toContain("\\sectionHeading{");
  expect(tex).not.toMatch(/\\shortReading\{/);
  expect(tex).not.toMatch(/\\concludingPrayer\{/);
  expect(tex).not.toMatch(/\\melodyRubric\{Mode /);
  expect(assembler.getGabcFiles().size).toBeGreaterThan(0);
  expect([...assembler.getGabcFiles().values()].some((g) => /^mode:/m.test(g))).toBe(true);
});

test("scored mode emits each psalmody antiphon at most once", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();

  const hybrid = new TexAssembler({ outputMode: "hybrid" }).assembleLauds(day.lauds, repo);
  const scored = new TexAssembler({ outputMode: "scored" }).assembleLauds(day.lauds, repo);

  const hybridScores = countMatches(hybrid, /\\lothScore\{/g);
  const scoredScores = countMatches(scored, /\\lothScore\{/g);

  // Closing antiphon repeats and psalm-tone-only closing blocks are omitted.
  expect(scoredScores).toBeLessThan(hybridScores);

  // No psalm prose sandwiched between scores (antiphon–psalm–antiphon collapsed).
  expect(scored).not.toMatch(/\\lothScore\{[^}]+\}[\s\S]*\\psalmText\{/);
});

test("default constructor preserves hybrid behaviour", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const tex = new TexAssembler().assembleLauds(day.lauds, repo);

  expect(tex).toContain("\\lothScore{");
  expect(tex).not.toMatch(/\\antiphon\{/);
  expect(tex).toContain("\\psalmText{");
  expect(tex).not.toMatch(/\\melodyRubric\{Mode /);
});
