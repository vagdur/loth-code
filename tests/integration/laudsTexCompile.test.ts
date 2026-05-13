/**
 * Requires `lualatex` + Gregorio on PATH. Regenerate fixture PDF with
 * `npm run test:fixtures:update` (sets UPDATE_FIXTURES=1).
 */

import { cpSync, mkdirSync, mkdtempSync, rmSync, statSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, expect, test } from "vitest";
import { LaudsTexAssembler } from "../../src/assemblers/laudsTex.js";
import { buildSampleAbstractDay, loadSampleRepo } from "../helpers/buildSampleDay.js";
import { normalizeLf } from "../helpers/normalizeLf.js";
import { fixturesDir } from "../helpers/paths.js";
import { runLualatex, writeTexFile } from "../../src/tools/compileTex.js";

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

    await runLualatex(tempDir, jobName, { stdio: "ignore" });

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
