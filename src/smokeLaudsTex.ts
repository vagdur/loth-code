/**
 * Build Lauds for a sample day and emit GregorioTeX-ready LaTeX.
 *
 * Usage:
 *   node dist/smokeLaudsTex.js              — write out/lauds-build/lauds.tex only
 *   node dist/smokeLaudsTex.js --compile   — also run lualatex (requires TeX + Gregorio)
 */

import path from "path";
import { fileURLToPath } from "url";
import { DataRepository } from "./data/repository.js";
import { resolveDay, defaultContext } from "./calendar/index.js";
import { buildDay } from "./hours/index.js";
import { LaudsTexAssembler } from "./assemblers/laudsTex.js";
import { runLualatex, writeTexFile } from "./tools/compileTex.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const outDir = path.resolve(process.cwd(), "out", "lauds-build");
const jobName = "lauds";

const repo = await DataRepository.load(dataDir);
const date = new Date("2026-05-10T00:00:00Z");
const day = resolveDay(date, "general");
const ctx = defaultContext();
const abs = buildDay(day, ctx);
const tex = new LaudsTexAssembler().assembleLauds(abs.lauds, repo);

const outPath = path.join(outDir, `${jobName}.tex`);
await writeTexFile(outPath, tex);
console.log(`Wrote ${outPath}`);

if (process.argv.includes("--compile")) {
  await runLualatex(outDir, jobName);
  console.log(`PDF should be at ${path.join(outDir, `${jobName}.pdf`)}`);
}
