/**
 * Golden .html snapshots for every hour + the full-day document, in each locale
 * and each HtmlAssembler output mode (`hybrid`, `plain`, `scored`).
 * The only locale is `en`: placeholder text with invented melodies, whose
 * scores travel inline in `data-gabc`.
 * Regenerate goldens: `npm run test:fixtures:update`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { HtmlAssembler, type HtmlOutputMode } from "../../src/assemblers/htmlAssembler.js";
import { eveningVespers } from "../../src/hours/index.js";
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
  render: (assembler: HtmlAssembler, day: AbstractDay, repo: DataRepository) => string;
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
    render: (a, day, repo) => a.assembleVespers(eveningVespers(day), repo),
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

const OUTPUT_MODES: ReadonlyArray<{ mode: HtmlOutputMode; suffix: string }> = [
  { mode: "hybrid", suffix: "" },
  { mode: "plain", suffix: "-plain" },
  { mode: "scored", suffix: "-scored" },
];

const matrix = SAMPLE_LOCALES.flatMap((locale) =>
  cases.flatMap((c) =>
    OUTPUT_MODES.map((output) => ({ ...c, locale, ...output })),
  ),
);

export function htmlFixturePath(
  jobName: string,
  locale: string,
  suffix: string,
): string {
  return path.join(fixturesDir, `${jobName}-${locale}-2026-05-10-general${suffix}.html`);
}

test.each(matrix)("[$locale/$mode] $name HTML matches fixture", async ({
  jobName, locale, mode, suffix, render,
}) => {
  const repo = await loadSampleRepo(locale);
  const abs = buildSampleAbstractDay();
  const assembler = new HtmlAssembler({ outputMode: mode });
  const html = normalizeLf(render(assembler, abs, repo));
  const scores = assembler.getScores();
  const fixturePath = htmlFixturePath(jobName, locale, suffix);

  if (process.env.UPDATE_FIXTURES === "1") {
    mkdirSync(path.dirname(fixturePath), { recursive: true });
    writeFileSync(fixturePath, html, "utf-8");
  }

  const expected = normalizeLf(readFileSync(fixturePath, "utf-8"));
  expect(html).toBe(expected);

  // Every registered score has a mount in the markup, and vice versa.
  const mountIds = [...html.matchAll(/data-score-id="([^"]+)"/g)].map((m) => m[1]);
  expect(mountIds).toEqual([...scores.keys()]);

  if (mode === "plain") {
    expect(scores.size).toBe(0);
    expect(html).not.toContain("data-loth-score");
  }
}, 5_000);
