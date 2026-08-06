/**
 * Scored PDF slots omit redundant plain macros; unscored slots keep them.
 *
 * Both cases run on the same locale — the second one loads the bundle with its
 * melody store emptied, which is the shape a locale has before its melodies
 * are transcribed.
 */

import { expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import { DataRepository } from "../../src/data/repository.js";
import { readRepoBundle } from "../../src/data/repositoryNode.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";
import { dataRoot, defaultLocale } from "../helpers/paths.js";

test("lauds omits plain macros when GABC scores are present", async () => {
  const repo = await loadSampleRepo();
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

test("lauds keeps plain macros when no melodies are loaded", async () => {
  const bundle = await readRepoBundle(dataRoot, defaultLocale);
  const repo = DataRepository.fromBundle({
    ...bundle,
    melodies: [],
    melodyAliases: [],
  });
  const day = buildSampleAbstractDay();
  const tex = new TexAssembler().assembleLauds(day.lauds, repo);

  expect(tex).not.toContain("\\lothScore{");
  expect(tex).toMatch(/\\versicle\{/);
  expect(tex).toMatch(/\\antiphon\{/);
  expect(tex).toMatch(/\\hymn\{/);
});
