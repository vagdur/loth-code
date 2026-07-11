/**
 * Probe whether GregorioTeX can auto-compile an embedded GABC score in this
 * environment. This needs `lualatex --shell-escape` AND a `gregorio` binary
 * whose major.minor matches the installed `gregoriotex` package.
 *
 * Score-bearing compile tests (the `sv` locale) skip when this returns false,
 * so the suite stays green on machines without a working GregorioTeX toolchain
 * and auto-runs where one is present. Result is memoised for the run.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { copyLothSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";
import { diagnoseGregorio, formatGregorioDiagnosis } from "./diagnoseGregorio.js";
import { parseLualatexLog } from "./parseLualatexLog.js";

const PROBE_TEX = `\\documentclass[11pt]{article}
\\usepackage{loth}
\\begin{filecontents}[overwrite,noheader]{probe-score.gabc}
name:probe-score;
%%
(c4) Al(f)le(g)lu(h)ia.(g) (::)
\\end{filecontents}
\\begin{document}
\\lothScore{probe-score}
\\end{document}
`;

let cached: Promise<boolean> | undefined;
let cachedDiagnosis: string | undefined;

async function probe(): Promise<boolean> {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(path.join(os.tmpdir(), "loth-gre-probe-"));
    await writeTexFile(path.join(dir, "probe.tex"), PROBE_TEX);
    await copyLothSty(dir);
    await runLualatex(dir, "probe", { stdio: "ignore" });

    const pdfPath = path.join(dir, "probe.pdf");
    if (existsSync(pdfPath)) return true;

    const logPath = path.join(dir, "probe.log");
    const logText = existsSync(logPath) ? readFileSync(logPath, "utf-8") : "";
    const { errors } = parseLualatexLog(logText);
    const diagnosis = diagnoseGregorio();
    cachedDiagnosis = [
      "Gregorio auto-compile probe failed.",
      errors.length > 0 ? `LuaLaTeX errors:\n${errors.join("\n\n")}` : "",
      formatGregorioDiagnosis(diagnosis),
    ].filter(Boolean).join("\n\n");
    console.warn(cachedDiagnosis);
    return false;
  } catch (err) {
    const diagnosis = diagnoseGregorio();
    cachedDiagnosis = [
      "Gregorio auto-compile probe failed.",
      err instanceof Error ? err.message : String(err),
      formatGregorioDiagnosis(diagnosis),
    ].join("\n\n");
    console.warn(cachedDiagnosis);
    return false;
  } finally {
    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // Windows can briefly lock aux files after lualatex exits.
      }
    }
  }
}

export function gregorioAutocompileWorks(): Promise<boolean> {
  if (!cached) cached = probe();
  return cached;
}

/** Last probe failure details (when gregorioAutocompileWorks() returned false). */
export function gregorioAutocompileDiagnosis(): string | undefined {
  return cachedDiagnosis;
}
