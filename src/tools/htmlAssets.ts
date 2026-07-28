/**
 * Copy the static assets an assembled HTML page needs, next to the page.
 * The counterpart of `copyLothSty` in compileTex.ts.
 */

import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

const LOTH_CSS_SOURCE = path.join(HERE, "../../html/loth.css");

/** exsurge's own package directory, wherever npm actually resolved it. */
export function exsurgeDir(): string {
  const require = createRequire(import.meta.url);
  return path.dirname(require.resolve("@vagdur/exsurge/package.json"));
}

/** The ES module build — what the page's import map should point at. */
export function exsurgeModulePath(): string {
  return path.join(exsurgeDir(), "dist", "exsurge.mjs");
}

/** ExsurgeChar.otf — the font exsurge draws ℣, ℟ and similar glyphs in. */
export function exsurgeFontPath(): string {
  return path.join(exsurgeDir(), "assets", "fonts", "ExsurgeChar.otf");
}

/**
 * Copy `html/loth.css` and the Exsurge Characters font into `dir`, matching the
 * `url("./ExsurgeChar.otf")` in the stylesheet's `@font-face`.
 */
export async function copyLothCss(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.copyFile(LOTH_CSS_SOURCE, path.join(dir, "loth.css"));
  await fs.copyFile(exsurgeFontPath(), path.join(dir, "ExsurgeChar.otf"));
}
