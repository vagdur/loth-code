/**
 * Scored PDF slots omit redundant plain macros; unscored slots keep them.
 */

import { expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";

test("sv lauds omits plain macros when GABC scores are present", async () => {
  const repo = await loadSampleRepo("sv");
  const day = buildSampleAbstractDay();
  const tex = new TexAssembler().assembleLauds(day.lauds, repo);

  expect(tex).toContain("\\lothScore{");
  expect(tex).not.toMatch(/\\versicle\{/);
  expect(tex).not.toMatch(/\\antiphon\{/);
  expect(tex).not.toMatch(/\\hymn\{/);
  expect(tex).not.toMatch(/\\shortResponsory\{/);
  expect(tex).not.toMatch(/\\lordsPrayerSection\{/);
  expect(tex).not.toMatch(/\\dismissal\{/);
  // Psalm and canticle prose are not sung-score duplicates.
  expect(tex).toContain("\\psalmText{");
  expect(tex).toContain("\\gospelCanticle{");
});

test("en lauds keeps plain macros when no melodies are loaded", async () => {
  const repo = await loadSampleRepo("en");
  const day = buildSampleAbstractDay();
  const tex = new TexAssembler().assembleLauds(day.lauds, repo);

  expect(tex).not.toContain("\\lothScore{");
  expect(tex).toMatch(/\\versicle\{/);
  expect(tex).toMatch(/\\antiphon\{/);
  expect(tex).toMatch(/\\hymn\{/);
});
