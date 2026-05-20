/**
 * Requires `lualatex` + Gregorio on PATH. Regenerate fixture PDF with
 * `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, expect, test } from "vitest";
import { LaudsTexAssembler } from "../../src/assemblers/laudsTex.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { parseLualatexLog, partitionHboxWarnings } from "../helpers/parseLualatexLog.js";
import { fixturesDir } from "../helpers/paths.js";
import { copyLothSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";

const jobName = "lauds";
const pdfFixtureName = "lauds-2026-05-10-general.pdf";

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

test(
  "Lauds TeX compiles with lualatex",
  async () => {
    const repo = await loadSampleRepo();
    const abs = buildSampleAbstractDay();
    const tex = normalizeLf(new LaudsTexAssembler().assembleLauds(abs.lauds, repo));

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
      cpSync(pdfPath, path.join(fixturesDir, pdfFixtureName));
    }
  },
  120_000,
);
