/**
 * Gospel-canticle antiphons (Benedictus / Magnificat / Nunc dimittis) carry a
 * pointed first-verse GABC part. Renderers emit that score when present, and
 * never as prose — the lyrics are the canticle's opening line.
 */

import { expect, test } from "vitest";
import { HtmlAssembler } from "../../src/assemblers/htmlAssembler.js";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import { DataRepository } from "../../src/data/repository.js";
import { readRepoBundle } from "../../src/data/repositoryNode.js";
import {
  buildSampleAbstractDay, loadSampleRepo,
} from "../helpers/buildSampleDay.js";
import { dataRoot, defaultLocale } from "../helpers/paths.js";

const INCIPIT_GABC = "Sam(e)ple(hg) point(hi)ed(i) first(h) verse";

function gabcValues(files: ReadonlyMap<string, string>): string[] {
  return [...files.values()];
}

test("hybrid TeX emits the gospel-canticle incipit score between the tone and the canticle", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler();
  const tex = assembler.assembleLauds(day.lauds, repo);
  const files = assembler.getGabcFiles();

  const incipitEntry = [...files.entries()].find(([, gabc]) => gabc.includes(INCIPIT_GABC));
  expect(incipitEntry).toBeDefined();
  const [filename] = incipitEntry!;
  const scoreId = filename.replace(/\.gabc$/, "");

  const heading = tex.indexOf("\\sectionHeading{BENEDICTUS}");
  const tone = tex.indexOf("\\psalmToneScore{", heading);
  const incipit = tex.indexOf(`\\lothScore{${scoreId}}`, heading);
  const canticle = tex.indexOf("\\gospelCanticle{", heading);
  expect(heading).toBeGreaterThan(-1);
  expect(tone).toBeGreaterThan(heading);
  expect(incipit).toBeGreaterThan(tone);
  expect(canticle).toBeGreaterThan(incipit);
});

test("plain TeX does not emit the incipit (it would duplicate the canticle text)", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler({ outputMode: "plain" });
  const tex = assembler.assembleLauds(day.lauds, repo);

  expect(assembler.getGabcFiles().size).toBe(0);
  expect(tex).toContain("\\gospelCanticle{");
  expect(tex).not.toContain("point(hi)ed");
});

test("scored TeX still emits the incipit score", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler({ outputMode: "scored" });
  assembler.assembleLauds(day.lauds, repo);

  expect(gabcValues(assembler.getGabcFiles()).some((g) => g.includes(INCIPIT_GABC))).toBe(true);
});

test("no incipit score when the melody store is empty", async () => {
  const bundle = await readRepoBundle(dataRoot, defaultLocale);
  const repo = DataRepository.fromBundle({
    ...bundle,
    melodies: [],
    melodyAliases: [],
  });
  const day = buildSampleAbstractDay();
  const assembler = new TexAssembler();
  assembler.assembleLauds(day.lauds, repo);

  expect(gabcValues(assembler.getGabcFiles()).some((g) => g.includes(INCIPIT_GABC))).toBe(false);
});

test("hybrid HTML inlines the same incipit GABC", async () => {
  const repo = await loadSampleRepo();
  const day = buildSampleAbstractDay();
  const assembler = new HtmlAssembler();
  const html = assembler.assembleLauds(day.lauds, repo).html();

  expect([...assembler.getScores().values()].some((g) => g.includes(INCIPIT_GABC))).toBe(true);
  expect(html).toContain("point(hi)ed");
});
