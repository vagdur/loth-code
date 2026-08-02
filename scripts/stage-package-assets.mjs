/**
 * Stage the assets that ship in the npm tarball but are not ours to keep in
 * git.
 *
 * `html/loth.css` declares its `@font-face` as `url("./ExsurgeChar.otf")` — a
 * sibling reference — but the font itself lives inside `@vagdur/exsurge`.  A
 * consumer's bundler resolves that URL relative to the stylesheet, so the font
 * has to sit next to it inside the published package.  Copying it at prepack
 * keeps exactly one copy in git (exsurge's) while still shipping a stylesheet
 * that resolves.
 *
 * Run by `prepack`.  The staged file is gitignored.
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { exsurgeFontPath } = await import("../dist/tools/htmlAssets.js");

const target = path.join(repoRoot, "html", "ExsurgeChar.otf");
const source = exsurgeFontPath();

await fs.copyFile(source, target);

const { size } = await fs.stat(target);
console.log(`staged html/ExsurgeChar.otf (${size} bytes) from ${source}`);
