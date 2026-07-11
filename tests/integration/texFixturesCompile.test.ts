/**
 * Compile every golden `.tex` fixture with LuaLaTeX and assert success.
 * Requires `lualatex` + Gregorio on PATH for score-bearing `sv` fixtures.
 * PDF fixtures are refreshed by `npm run test:fixtures:update` via the
 * snapshot tests that write `.tex` and compile inline.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, expect, test } from "vitest";
import {
  compileTexJob,
  detectTexPackage,
  needsGregorioScores,
} from "../helpers/compileFixtureTex.js";
import { gregorioAutocompileDiagnosis, gregorioAutocompileWorks } from "../helpers/gregorioAutocompile.js";
import { fixturesDir } from "../helpers/paths.js";

const fixtureTexFiles = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".tex"))
  .sort();

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

test.for(fixtureTexFiles)(
  "fixture %s compiles with lualatex",
  async (fixtureName, ctx) => {
    const fixturePath = path.join(fixturesDir, fixtureName);
    const tex = readFileSync(fixturePath, "utf-8");

    if (needsGregorioScores(tex) && !(await gregorioAutocompileWorks())) {
      const diagnosis = gregorioAutocompileDiagnosis();
      if (diagnosis) ctx.skip(diagnosis);
      else ctx.skip("Gregorio auto-compile unavailable");
      return;
    }

    tempDir = mkdtempSync(path.join(os.tmpdir(), "loth-fixture-lualatex-"));
    const jobName = fixtureName.replace(/\.tex$/i, "");
    const { pdfPath } = await compileTexJob(tempDir, jobName, tex, detectTexPackage(tex));

    expect(pdfPath).toBeTruthy();
  },
  180_000,
);
