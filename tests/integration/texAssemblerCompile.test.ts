/**
 * Compiles every hour + the full-day document with lualatex.
 * Requires `lualatex` + Gregorio on PATH. Regenerate fixture PDFs with
 * `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, expect, test } from "vitest";
import { TexAssembler } from "../../src/assemblers/texAssembler.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { parseLualatexLog, partitionHboxWarnings } from "../helpers/parseLualatexLog.js";
import { fixturesDir } from "../helpers/paths.js";
import { copyLothSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";
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

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows can briefly lock aux files after lualatex exits.
    }
    tempDir = undefined;
  }
});

test.each(cases)(
  "$name TeX compiles with lualatex",
  async ({ jobName, render }) => {
    const repo = await loadSampleRepo();
    const abs = buildSampleAbstractDay();
    const tex = normalizeLf(render(abs, repo));

    tempDir = mkdtempSync(path.join(os.tmpdir(), "loth-lualatex-"));
    const texPath = path.join(tempDir, `${jobName}.tex`);
    await writeTexFile(texPath, tex);
    await copyLothSty(tempDir);

    await runLualatex(tempDir, jobName, { stdio: "ignore" });

    const logPath = path.join(tempDir, `${jobName}.log`);
    const logText = readFileSync(logPath, "utf-8");
    const { errors, warnings } = parseLualatexLog(logText);
    if (errors.length > 0) {
      throw new Error(
        `lualatex reported errors in ${jobName}.log:\n\n${errors.join("\n\n---\n\n")}`,
      );
    }

    const { hbox, other } = partitionHboxWarnings(warnings);
    for (const w of other) {
      console.warn(`[lualatex] ${w}`);
    }
    if (hbox.length > 0) {
      const sample = hbox.slice(0, 3).join("\n");
      const extra = hbox.length > 3 ? `\n… and ${hbox.length - 3} more \\hbox warnings` : "";
      console.warn(
        `[lualatex] ${hbox.length} Underfull/Overfull \\hbox warning(s) (showing up to 3):\n${sample}${extra}`,
      );
    }

    const pdfPath = path.join(tempDir, `${jobName}.pdf`);
    const st = statSync(pdfPath);
    expect(st.size).toBeGreaterThan(0);

    if (process.env.UPDATE_FIXTURES === "1") {
      mkdirSync(fixturesDir, { recursive: true });
      cpSync(pdfPath, path.join(fixturesDir, `${jobName}-2026-05-10-general.pdf`));
    }
  },
  120_000,
);
