/**
 * Write LaTeX source to disk and optionally run LuaLaTeX (for GregorioTeX scores).
 */

import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const LOTH_STY_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tex/loth.sty",
);

export async function writeTexFile(outPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, content, "utf-8");
}

/** Copy `tex/loth.sty` next to a generated `.tex` so LuaLaTeX can `\\usepackage{loth}`. */
export async function copyLothSty(jobDir: string): Promise<void> {
  const dest = path.join(jobDir, "loth.sty");
  await fs.copyFile(LOTH_STY_SOURCE, dest);
}

const ORDO_STY_SOURCE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tex/ordo.sty",
);

/** Copy `tex/ordo.sty` next to a generated `.tex` so LuaLaTeX can `\\usepackage{ordo}`. */
export async function copyOrdoSty(jobDir: string): Promise<void> {
  const dest = path.join(jobDir, "ordo.sty");
  await fs.copyFile(ORDO_STY_SOURCE, dest);
}

export type LualatexStdio = "inherit" | "pipe" | "ignore";

/**
 * Run `lualatex` in `jobDir` on `jobName.tex`.
 *
 * `--shell-escape` is required so GregorioTeX can auto-compile GABC scores
 * (`\gregorioscore` → gregorio) on the fly; without it, any document that
 * emits a score fails to find its `.gtex`.
 */
export async function runLualatex(
  jobDir: string,
  jobName: string,
  options?: { stdio?: LualatexStdio; passes?: number },
): Promise<void> {
  const stdio = options?.stdio ?? "inherit";
  const passes = options?.passes ?? 2;
  const texFile = `${jobName}.tex`;
  for (let i = 0; i < passes; i++) {
    await spawnAsync("lualatex", ["-interaction=nonstopmode", "--shell-escape", texFile], {
      cwd: jobDir,
      stdio,
    });
  }
}

function spawnAsync(
  command: string,
  args: string[],
  options: { cwd: string; stdio: LualatexStdio },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: options.stdio,
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`"${command}" exited with code ${code ?? "unknown"}`));
    });
  });
}
