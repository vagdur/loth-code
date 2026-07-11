/**
 * Probe whether GregorioTeX can auto-compile an embedded GABC score in this
 * environment. This needs `lualatex --shell-escape` AND a `gregorio` binary
 * whose major.minor matches the installed `gregoriotex` package; a stale
 * MiKTeX (old gregorio vs newer gregoriotex) refuses to auto-compile.
 *
 * Score-bearing compile tests (the `sv` locale) skip when this returns false,
 * so the suite stays green on machines without a working GregorioTeX toolchain
 * and auto-runs where one is present. Result is memoised for the run.
 */

import { existsSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { copyLothSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";

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

async function probe(): Promise<boolean> {
  let dir: string | undefined;
  try {
    dir = mkdtempSync(path.join(os.tmpdir(), "loth-gre-probe-"));
    await writeTexFile(path.join(dir, "probe.tex"), PROBE_TEX);
    await copyLothSty(dir);
    await runLualatex(dir, "probe", { stdio: "ignore" });
    return existsSync(path.join(dir, "probe.pdf"));
  } catch {
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
