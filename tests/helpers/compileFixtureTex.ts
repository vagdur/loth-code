/**
 * Compile a `.tex` document with LuaLaTeX and scan the log for hard errors.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { copyLothSty, copyOrdoSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";
import { parseLualatexLog, partitionHboxWarnings } from "./parseLualatexLog.js";

export type TexPackage = "loth" | "ordo";

export function detectTexPackage(tex: string): TexPackage {
  return /\\usepackage\{ordo\}/.test(tex) ? "ordo" : "loth";
}

export function needsGregorioScores(tex: string): boolean {
  return /\\(lothScore|psalmToneScore)\{/.test(tex);
}

export async function copyTexPackageSty(jobDir: string, pkg: TexPackage): Promise<void> {
  if (pkg === "ordo") await copyOrdoSty(jobDir);
  else await copyLothSty(jobDir);
}

/**
 * Write `tex`, copy the matching `.sty`, run LuaLaTeX twice, and assert a non-empty PDF.
 */
export async function compileTexJob(
  jobDir: string,
  jobName: string,
  tex: string,
  pkg: TexPackage,
): Promise<{ pdfPath: string; logPath: string }> {
  await writeTexFile(path.join(jobDir, `${jobName}.tex`), tex);
  await copyTexPackageSty(jobDir, pkg);
  await runLualatex(jobDir, jobName, { stdio: "ignore" });

  const logPath = path.join(jobDir, `${jobName}.log`);
  assertLualatexLogOk(logPath, jobName);

  const pdfPath = path.join(jobDir, `${jobName}.pdf`);
  const st = statSync(pdfPath);
  if (st.size <= 0) {
    throw new Error(`lualatex produced an empty PDF for ${jobName}`);
  }

  return { pdfPath, logPath };
}

export function assertLualatexLogOk(logPath: string, jobName: string): void {
  const logText = readFileSync(logPath, "utf-8");
  const { errors, warnings } = parseLualatexLog(logText);
  if (errors.length > 0) {
    throw new Error(
      `lualatex reported errors in ${jobName}.log:\n\n${errors.join("\n\n---\n\n")}`,
    );
  }

  const { hbox, other } = partitionHboxWarnings(warnings);
  for (const w of other) {
    console.warn(`[lualatex:${jobName}] ${w}`);
  }
  if (hbox.length > 0) {
    const sample = hbox.slice(0, 3).join("\n");
    const extra = hbox.length > 3 ? `\n… and ${hbox.length - 3} more \\hbox warnings` : "";
    console.warn(
      `[lualatex:${jobName}] ${hbox.length} Underfull/Overfull \\hbox warning(s) (showing up to 3):\n${sample}${extra}`,
    );
  }
}

/** Copy a compiled PDF next to its golden `.tex` fixture (same basename). */
export function updateFixturePdf(fixtureTexPath: string, pdfPath: string): void {
  const pdfFixturePath = fixtureTexPath.replace(/\.tex$/i, ".pdf");
  mkdirSync(path.dirname(pdfFixturePath), { recursive: true });
  cpSync(pdfPath, pdfFixturePath);
}

/**
 * Write a golden `.tex` fixture and compile its PDF (when the toolchain allows).
 * Score-bearing documents are skipped when Gregorio auto-compile is unavailable.
 */
export async function writeFixtureTexAndPdf(
  fixtureTexPath: string,
  tex: string,
  pkg: TexPackage,
  gregorioWorks: () => Promise<boolean>,
): Promise<void> {
  mkdirSync(path.dirname(fixtureTexPath), { recursive: true });
  writeFileSync(fixtureTexPath, tex, "utf-8");

  if (needsGregorioScores(tex) && !(await gregorioWorks())) {
    console.warn(`Skipping PDF update for ${path.basename(fixtureTexPath)}: Gregorio unavailable`);
    return;
  }

  const tempDir = mkdtempSync(path.join(os.tmpdir(), "loth-fixture-update-"));
  try {
    const jobName = path.basename(fixtureTexPath, ".tex");
    const { pdfPath } = await compileTexJob(tempDir, jobName, tex, pkg);
    updateFixturePdf(fixtureTexPath, pdfPath);
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows can briefly lock aux files after lualatex exits.
    }
  }
}
