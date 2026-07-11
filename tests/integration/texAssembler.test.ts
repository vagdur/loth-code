/**
 * Golden .tex snapshots for every hour + the full-day document.
 * Regenerate goldens: `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { AbstractDay } from "../../src/types/hours.js";

type Case = {
  name: string;
  fixture: string;
  render: (day: AbstractDay, repo: DataRepository) => string;
};

const cases: Case[] = [
  {
    name: "Office of Readings",
    fixture: "office-of-readings-2026-05-10-general.tex",
    render: (day, repo) => new TexAssembler().assembleOfficeOfReadings(day.officeOfReadings, repo),
  },
  {
    name: "Lauds",
    fixture: "lauds-2026-05-10-general.tex",
    render: (day, repo) => new TexAssembler().assembleLauds(day.lauds, repo),
  },
  {
    name: "Daytime Prayer (Sext)",
    fixture: "sext-2026-05-10-general.tex",
    render: (day, repo) => {
      if (!day.sext) throw new Error("sample day has no Sext");
      return new TexAssembler().assembleDaytimePrayer(day.sext, repo);
    },
  },
  {
    name: "Vespers",
    fixture: "vespers-2026-05-10-general.tex",
    render: (day, repo) => new TexAssembler().assembleVespers(day.vespers, repo),
  },
  {
    name: "Compline",
    fixture: "compline-2026-05-10-general.tex",
    render: (day, repo) => new TexAssembler().assembleCompline(day.compline, repo),
  },
  {
    name: "Full day",
    fixture: "day-2026-05-10-general.tex",
    render: (day, repo) => new TexAssembler().assembleDay(day, repo),
  },
];

test.each(cases)("$name TeX matches fixture", async ({ fixture, render }) => {
  const repo = await loadSampleRepo();
  const abs = buildSampleAbstractDay();
  const tex = normalizeLf(render(abs, repo));
  const fixturePath = path.join(fixturesDir, fixture);

  if (process.env.UPDATE_FIXTURES === "1") {
    mkdirSync(fixturesDir, { recursive: true });
    writeFileSync(fixturePath, tex, "utf-8");
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);
});
