/**
 * Golden .tex snapshots for every hour + the full-day document, in each locale.
 * `en` is dummy data (no melodies); `sv` is real data that embeds GABC scores.
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import {
  buildSampleAbstractDay, loadSampleRepo, SAMPLE_LOCALES,
} from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { AbstractDay } from "../../src/types/hours.js";

type Case = {
  name: string;
  jobName: string;
  render: (day: AbstractDay, repo: DataRepository) => string;
};

const cases: Case[] = [
  {
    name: "Office of Readings",
    jobName: "office-of-readings",
    render: (day, repo) => new TexAssembler().assembleOfficeOfReadings(day.officeOfReadings, repo),
  },
  {
    name: "Lauds",
    jobName: "lauds",
    render: (day, repo) => new TexAssembler().assembleLauds(day.lauds, repo),
  },
  {
    name: "Daytime Prayer (Sext)",
    jobName: "sext",
    render: (day, repo) => {
      if (!day.sext) throw new Error("sample day has no Sext");
      return new TexAssembler().assembleDaytimePrayer(day.sext, repo);
    },
  },
  {
    name: "Vespers",
    jobName: "vespers",
    render: (day, repo) => new TexAssembler().assembleVespers(day.vespers, repo),
  },
  {
    name: "Compline",
    jobName: "compline",
    render: (day, repo) => new TexAssembler().assembleCompline(day.compline, repo),
  },
  {
    name: "Full day",
    jobName: "day",
    render: (day, repo) => new TexAssembler().assembleDay(day, repo),
  },
];

const matrix = SAMPLE_LOCALES.flatMap((locale) =>
  cases.map((c) => ({ ...c, locale })),
);

test.each(matrix)("[$locale] $name TeX matches fixture", async ({ jobName, locale, render }) => {
  const repo = await loadSampleRepo(locale);
  const abs = buildSampleAbstractDay();
  const tex = normalizeLf(render(abs, repo));
  const fixturePath = path.join(fixturesDir, `${jobName}-${locale}-2026-05-10-general.tex`);

  if (process.env.UPDATE_FIXTURES === "1") {
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(fixturePath, tex, "utf-8");
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);
});
