/**
 * Compile every golden `.tex` fixture with LuaLaTeX and assert success.
 * Score-bearing fixtures reuse `tests/fixtures/.compile-cache/` so unchanged
 * GABC is not recompiled on every test run.
 */

import { mkdirSync, readdirSync, readFileSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import {
  compileTexJob,
  detectTexPackage,
  needsGregorioScores,
} from "../helpers/compileFixtureTex.js";
import {
  fixtureGregorioCacheDir,
} from "../helpers/gregorioCache.js";
import { gregorioAutocompileDiagnosis, gregorioAutocompileWorks } from "../helpers/gregorioAutocompile.js";
import { fixturesDir } from "../helpers/paths.js";

const fixtureTexFiles = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".tex"))
  .sort();

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

    const jobName = fixtureName.replace(/\.tex$/i, "");
    const jobDir = fixtureGregorioCacheDir(jobName, fixturesDir);
    mkdirSync(jobDir, { recursive: true });

    const { pdfPath } = await compileTexJob(jobDir, jobName, tex, detectTexPackage(tex), {
      jobDir,
      gabcSourceDir: fixturesDir,
      gregorioCacheDir: jobDir,
    });

    expect(pdfPath).toBeTruthy();
  },
  180_000,
);
