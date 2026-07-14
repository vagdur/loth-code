/**
 * Compile a `.tex` document with LuaLaTeX and scan the log for hard errors.
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { copyLothSty, copyOrdoSty, runLualatex, writeTexFile } from "../../src/tools/compileTex.js";
import {
  fixtureGregorioCacheDir,
  prepareGregorioCompile,
  refreshGregorioCache,
  writeFixtureGabcFiles,
} from "./gregorioCache.js";
import { parseLualatexLog, partitionHboxWarnings } from "./parseLualatexLog.js";
import { fixturesDir } from "./paths.js";

export type TexPackage = "loth" | "ordo";

export type CompileTexOptions = {
  /** Persistent job directory; defaults to a temp dir. */
  jobDir?: string;
  /** Directory containing sibling `.gabc` golden files (fixture compiles). */
  gabcSourceDir?: string;
  /** Persist Gregorio `.gtex` cache here between compiles. */
  gregorioCacheDir?: string;
};

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
 * Write `tex`, copy the matching `.sty`, run LuaLaTeX, and assert a non-empty PDF.
 */
export async function compileTexJob(
  jobDir: string,
  jobName: string,
  tex: string,
  pkg: TexPackage,
  options?: CompileTexOptions,
): Promise<{ pdfPath: string; logPath: string }> {
  let compileTex = tex;
  let gregorioCacheHit = false;
  let gregorioScores: string[] = [];

  if (pkg === "loth" && needsGregorioScores(tex)) {
    const cacheDir = options?.gregorioCacheDir
      ?? fixtureGregorioCacheDir(jobName, fixturesDir);
    const prepared = prepareGregorioCompile(jobDir, tex, {
      cacheDir,
      gabcSourceDir: options?.gabcSourceDir,
    });
    compileTex = prepared.tex;
    gregorioCacheHit = prepared.cacheHit;
    gregorioScores = prepared.scores;
  }

  await writeTexFile(path.join(jobDir, `${jobName}.tex`), compileTex);
  await copyTexPackageSty(jobDir, pkg);

  await runLualatex(jobDir, jobName, {
    stdio: "ignore",
    passes: gregorioCacheHit ? 1 : 2,
  });

  const logPath = path.join(jobDir, `${jobName}.log`);
  assertLualatexLogOk(logPath, jobName);

  const pdfPath = path.join(jobDir, `${jobName}.pdf`);
  const st = statSync(pdfPath);
  if (st.size <= 0) {
    throw new Error(`lualatex produced an empty PDF for ${jobName}`);
  }

  if (gregorioScores.length > 0) {
    const cacheDir = options?.gregorioCacheDir
      ?? fixtureGregorioCacheDir(jobName, fixturesDir);
    refreshGregorioCache(jobDir, cacheDir, gregorioScores);
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

/** Write a golden `.tex` and sibling `.gabc` fixtures (no PDF). */
export function writeFixtureTex(
  fixtureTexPath: string,
  tex: string,
  gabcFiles: ReadonlyMap<string, string>,
): void {
  const targetDir = path.dirname(fixtureTexPath);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(fixtureTexPath, tex, "utf-8");
  writeFixtureGabcFiles(gabcFiles, targetDir);
}

/** Compile an existing golden `.tex` and refresh its sibling `.pdf` for human review. */
export async function compileFixturePdf(
  fixtureTexPath: string,
  gregorioWorks: () => Promise<boolean>,
): Promise<void> {
  const tex = readFileSync(fixtureTexPath, "utf-8");
  const pkg = detectTexPackage(tex);
  const targetDir = path.dirname(fixtureTexPath);

  if (needsGregorioScores(tex) && !(await gregorioWorks())) {
    console.warn(`Skipping PDF update for ${path.basename(fixtureTexPath)}: Gregorio unavailable`);
    return;
  }

  const jobName = path.basename(fixtureTexPath, ".tex");
  const jobDir = fixtureGregorioCacheDir(jobName, targetDir);
  mkdirSync(jobDir, { recursive: true });

  const { pdfPath } = await compileTexJob(jobDir, jobName, tex, pkg, {
    jobDir,
    gabcSourceDir: targetDir,
    gregorioCacheDir: jobDir,
  });
  updateFixturePdf(fixtureTexPath, pdfPath);
}

/**
 * Write golden `.tex` + `.gabc` fixtures and compile the sibling `.pdf`.
 * Prefer `writeFixtureTex` + `compileFixturePdf` when updating sources and PDFs separately.
 */
export async function writeFixtureTexAndPdf(
  fixtureTexPath: string,
  tex: string,
  gabcFiles: ReadonlyMap<string, string>,
  _pkg: TexPackage,
  gregorioWorks: () => Promise<boolean>,
): Promise<void> {
  writeFixtureTex(fixtureTexPath, tex, gabcFiles);
  await compileFixturePdf(fixtureTexPath, gregorioWorks);
}

/** Compile in a disposable directory (e.g. one-off smoke tests). */
export async function compileTexJobEphemeral(
  jobName: string,
  tex: string,
  pkg: TexPackage,
  options?: Omit<CompileTexOptions, "jobDir">,
): Promise<{ pdfPath: string; logPath: string }> {
  const jobDir = mkdtempSync(path.join(os.tmpdir(), "loth-lualatex-"));
  try {
    return await compileTexJob(jobDir, jobName, tex, pkg, { ...options, jobDir });
  } finally {
    try {
      rmSync(jobDir, { recursive: true, force: true });
    } catch {
      // Windows can briefly lock aux files after lualatex exits.
    }
  }
}
