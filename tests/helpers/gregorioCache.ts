/**
 * GABC score files and Gregorio `.gtex` caching for fixture compiles.
 *
 * GregorioTeX `auto` mode skips recompilation when the on-disk `.gabc` is older
 * than its cached `.gtex`. `filecontents` breaks that by rewriting `.gabc` on
 * every LaTeX pass, so we keep scores as sibling files and optionally reuse a
 * persistent `tmp-gre/` cache between runs.
 */

import { createHash } from "crypto";
import {
  cpSync, existsSync, mkdirSync, readFileSync, writeFileSync,
} from "fs";
import path from "path";
import { diagnoseGregorio } from "./diagnoseGregorio.js";

const FILECONTENTS_RE =
  /\\begin\{filecontents\}\[overwrite,noheader\]\{([^}]+)\}\s*\n([\s\S]*?)\\end\{filecontents\}\s*/g;

const SCORE_REF_RE = /\\(?:lothScore|psalmToneScore)\{([^}]+)\}/g;

export type GregorioCompileMode = "auto";

export type PrepareGregorioResult = {
  tex: string;
  /** True when every score restored a cached `.gtex` for the current GABC hash. */
  cacheHit: boolean;
  scores: string[];
};

export type GregorioCacheManifest = {
  gregoriotexVersion: string;
  scores: Record<string, { hash: string; gtex: string }>;
};

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function gregoriotexVersionTag(): string {
  const version = diagnoseGregorio().gregoriotexVersion ?? "6.1.0";
  return version.replace(/\./g, "_");
}

export function gtexRelPath(scoreBase: string, versionTag = gregoriotexVersionTag()): string {
  return path.join("tmp-gre", `${scoreBase}-${versionTag}.gtex`);
}

export function extractFilecontentsGabc(tex: string): { texWithout: string; gabc: Map<string, string> } {
  const gabc = new Map<string, string>();
  const texWithout = tex.replace(FILECONTENTS_RE, (_match, name: string, body: string) => {
    gabc.set(name, body.endsWith("\n") ? body : `${body}\n`);
    return "";
  });
  return { texWithout: texWithout.trimStart(), gabc };
}

export function scoreRefsFromTex(tex: string): string[] {
  const refs = new Set<string>();
  for (const match of tex.matchAll(SCORE_REF_RE)) {
    refs.add(match[1]!);
  }
  return [...refs].sort();
}

export function injectCompileGabcMode(tex: string, mode: "auto" | "never"): string {
  if (!/\\(?:lothScore|psalmToneScore)\{/.test(tex)) return tex;
  if (/\\gresetcompilegabc\{/.test(tex)) return tex;
  return tex.replace(
    /(\\usepackage\{loth\})/,
    `$1\n\\gresetcompilegabc{${mode}}`,
  );
}

function manifestPath(cacheDir: string): string {
  return path.join(cacheDir, "manifest.json");
}

function loadManifest(cacheDir: string): GregorioCacheManifest | undefined {
  const file = manifestPath(cacheDir);
  if (!existsSync(file)) return undefined;
  return JSON.parse(readFileSync(file, "utf-8")) as GregorioCacheManifest;
}

function saveManifest(cacheDir: string, manifest: GregorioCacheManifest): void {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(manifestPath(cacheDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function writeGabcIfChanged(filePath: string, content: string): void {
  if (existsSync(filePath) && readFileSync(filePath, "utf-8") === content) return;
  writeFileSync(filePath, content, "utf-8");
}

function copyIfExists(src: string, dest: string): boolean {
  if (!existsSync(src)) return false;
  if (path.resolve(src) === path.resolve(dest)) return true;
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(src, dest);
  return true;
}

/**
 * Resolve GABC for a fixture, write sibling `.gabc` files into `jobDir`, and
 * restore cached `.gtex` files when content hashes still match.
 */
export function prepareGregorioCompile(
  jobDir: string,
  tex: string,
  options: { cacheDir: string; gabcSourceDir?: string },
): PrepareGregorioResult {
  mkdirSync(jobDir, { recursive: true });

  const extracted = extractFilecontentsGabc(tex);
  let bodyTex = extracted.texWithout;
  const gabcByFile = new Map(extracted.gabc);

  for (const base of scoreRefsFromTex(bodyTex)) {
    const filename = `${base}.gabc`;
    if (gabcByFile.has(filename)) continue;
    const sibling = path.join(options.gabcSourceDir ?? jobDir, filename);
    if (existsSync(sibling)) {
      gabcByFile.set(filename, readFileSync(sibling, "utf-8"));
    }
  }

  const versionTag = gregoriotexVersionTag();
  const version = diagnoseGregorio().gregoriotexVersion ?? "6.1.0";
  const manifest = loadManifest(options.cacheDir);
  let cacheHit = gabcByFile.size > 0;

  for (const [filename, content] of gabcByFile) {
    const base = filename.replace(/\.gabc$/i, "");
    const hash = hashContent(content);
    writeGabcIfChanged(path.join(jobDir, filename), content);

    const gtexRel = gtexRelPath(base, versionTag);
    const gtexJob = path.join(jobDir, gtexRel);
    const gtexCache = path.join(options.cacheDir, gtexRel);
    const cached = manifest?.gregoriotexVersion === version
      ? manifest.scores[base]
      : undefined;

    if (cached?.hash === hash && copyIfExists(gtexCache, gtexJob)) {
      const glogRel = gtexRel.replace(/\.gtex$/i, ".glog");
      copyIfExists(path.join(options.cacheDir, glogRel), path.join(jobDir, glogRel));
      continue;
    }

    cacheHit = false;
  }

  return {
    tex: bodyTex,
    cacheHit,
    scores: [...gabcByFile.keys()].map((f) => f.replace(/\.gabc$/i, "")),
  };
}

/** Persist freshly built `.gtex` files from a compile job into the cache. */
export function refreshGregorioCache(
  jobDir: string,
  cacheDir: string,
  scores: string[],
): void {
  const version = diagnoseGregorio().gregoriotexVersion ?? "6.1.0";
  const versionTag = version.replace(/\./g, "_");
  const manifest: GregorioCacheManifest = {
    gregoriotexVersion: version,
    scores: {},
  };

  for (const base of scores) {
    const filename = `${base}.gabc`;
    const gabcPath = path.join(jobDir, filename);
    if (!existsSync(gabcPath)) continue;

    const gtexRel = gtexRelPath(base, versionTag);
    const gtexJob = path.join(jobDir, gtexRel);
    if (!existsSync(gtexJob)) continue;

    const hash = hashContent(readFileSync(gabcPath, "utf-8"));
    const gtexCache = path.join(cacheDir, gtexRel);
    mkdirSync(path.dirname(gtexCache), { recursive: true });
    if (path.resolve(gtexJob) !== path.resolve(gtexCache)) {
      cpSync(gtexJob, gtexCache);
    }
    const glogRel = gtexRel.replace(/\.gtex$/i, ".glog");
    copyIfExists(path.join(jobDir, glogRel), path.join(cacheDir, glogRel));
    manifest.scores[base] = { hash, gtex: gtexRel.replace(/\\/g, "/") };
  }

  saveManifest(cacheDir, manifest);
}

export function writeFixtureGabcFiles(gabc: ReadonlyMap<string, string>, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  for (const [filename, content] of gabc) {
    writeGabcIfChanged(path.join(targetDir, filename), content);
  }
}

/** Remove legacy `filecontents` blocks from committed fixtures (one-time migration). */
export function stripLegacyFilecontentsFromFixture(fixtureTexPath: string): boolean {
  const raw = readFileSync(fixtureTexPath, "utf-8");
  const { texWithout, gabc } = extractFilecontentsGabc(raw);
  if (gabc.size === 0) return false;

  writeFileSync(fixtureTexPath, texWithout, "utf-8");
  writeFixtureGabcFiles(gabc, path.dirname(fixtureTexPath));
  return true;
}

export function fixtureGregorioCacheDir(jobName: string, fixturesRoot: string): string {
  return path.join(fixturesRoot, ".compile-cache", jobName);
}
