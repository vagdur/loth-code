/**
 * Golden .tex snapshots for every hour + the full-day document, in each locale
 * and each TexAssembler output mode (`hybrid`, `plain`, `scored`).
 * `en` is dummy data (no melodies); `sv` is real data with sibling `.gabc` scores.
 * Regenerate goldens (`.tex`, `.gabc`, `.pdf`): `npm run test:fixtures:update`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { TexAssembler, type TexOutputMode } from "../../src/assemblers/texAssembler.js";
import {
  buildSampleAbstractDay, loadSampleRepo, SAMPLE_LOCALES,
} from "../helpers/buildSampleDay.js";
import { needsGregorioScores, writeFixtureTexAndPdf } from "../helpers/compileFixtureTex.js";
import { gregorioAutocompileDiagnosis, gregorioAutocompileWorks } from "../helpers/gregorioAutocompile.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";
import type { DataRepository } from "../../src/data/repository.js";
import type { AbstractDay } from "../../src/types/hours.js";

type Case = {
  name: string;
  jobName: string;
  render: (assembler: TexAssembler, day: AbstractDay, repo: DataRepository) => string;
};

const cases: Case[] = [
  {
    name: "Office of Readings",
    jobName: "office-of-readings",
    render: (a, day, repo) => a.assembleOfficeOfReadings(day.officeOfReadings, repo),
  },
  {
    name: "Lauds",
    jobName: "lauds",
    render: (a, day, repo) => a.assembleLauds(day.lauds, repo),
  },
  {
    name: "Daytime Prayer (Sext)",
    jobName: "sext",
    render: (a, day, repo) => {
      if (!day.sext) throw new Error("sample day has no Sext");
      return a.assembleDaytimePrayer(day.sext, repo);
    },
  },
  {
    name: "Vespers",
    jobName: "vespers",
    render: (a, day, repo) => a.assembleVespers(day.vespers, repo),
  },
  {
    name: "Compline",
    jobName: "compline",
    render: (a, day, repo) => a.assembleCompline(day.compline, repo),
  },
  {
    name: "Full day",
    jobName: "day",
    render: (a, day, repo) => a.assembleDay(day, repo),
  },
];

const OUTPUT_MODES: ReadonlyArray<{ mode: TexOutputMode; suffix: string }> = [
  { mode: "hybrid", suffix: "" },
  { mode: "plain", suffix: "-plain" },
  { mode: "scored", suffix: "-scored" },
];

const matrix = SAMPLE_LOCALES.flatMap((locale) =>
  cases.flatMap((c) =>
    OUTPUT_MODES.map((output) => ({ ...c, locale, ...output })),
  ),
);

test.each(matrix)("[$locale/$mode] $name TeX matches fixture", async ({
  jobName, locale, mode, suffix, render,
}) => {
  const repo = await loadSampleRepo(locale);
  const abs = buildSampleAbstractDay();
  const assembler = new TexAssembler({ outputMode: mode });
  const tex = normalizeLf(render(assembler, abs, repo));
  const gabcFiles = assembler.getGabcFiles();
  const fixturePath = path.join(
    fixturesDir,
    `${jobName}-${locale}-2026-05-10-general${suffix}.tex`,
  );

  if (process.env.UPDATE_FIXTURES === "1") {
    if (needsGregorioScores(tex) && !(await gregorioAutocompileWorks())) {
      const diagnosis = gregorioAutocompileDiagnosis();
      console.warn(
        diagnosis
          ? `Skipping PDF update for ${path.basename(fixturePath)}:\n${diagnosis}`
          : `Skipping PDF update for ${path.basename(fixturePath)}: Gregorio unavailable`,
      );
      mkdirSync(fixturesDir, { recursive: true });
      writeFileSync(fixturePath, tex, "utf-8");
      for (const [name, content] of gabcFiles) {
        writeFileSync(path.join(fixturesDir, name), content, "utf-8");
      }
    } else {
      await writeFixtureTexAndPdf(fixturePath, tex, gabcFiles, "loth", gregorioAutocompileWorks);
    }
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(tex).toBe(expected);

  if (mode !== "plain") {
    for (const [name, content] of gabcFiles) {
      const gabcPath = path.join(fixturesDir, name);
      expect(existsSync(gabcPath), `missing golden ${name}`).toBe(true);
      expect(normalizeLf(readFileSync(gabcPath, "utf-8"))).toBe(normalizeLf(content));
    }
  } else {
    expect(gabcFiles.size).toBe(0);
  }
}, process.env.UPDATE_FIXTURES === "1" ? 600_000 : 5_000);
