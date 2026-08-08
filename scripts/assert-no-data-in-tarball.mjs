/**
 * Refuse to publish a tarball containing anything but code.
 *
 * `data/en/` here is placeholder text for the tests, but a real locale's tree
 * is somebody else's copyrighted translation, and this package is what such a
 * tree gets pointed at. Shipping any data directory at all would set the wrong
 * precedent, and npm publishes are irrevocable, so a mistake in the `files`
 * field is not a thing to find out about afterwards.
 *
 * This is an allowlist, not a denylist: every path in the tarball must match
 * one of the patterns below. A denylist would pass a data directory nobody
 * thought to add to it.
 *
 *   node scripts/assert-no-data-in-tarball.mjs
 *
 * Wired into `prepublishOnly`, and worth running as its own CI job so it
 * cannot be skipped with `--ignore-scripts`.
 */

import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Anything not matched by one of these must not ship. */
const ALLOWED = [
  /^dist\/(?!\.)[^\n]+\.(?:d\.ts\.map|d\.ts|js\.map|js|mjs)$/,
  // Copied next to a generated .tex by src/tools/compileTex.ts, so the LaTeX
  // path works from an installed package and not only from a checkout.
  /^tex\/(loth|ordo)\.sty$/,
  /^html\/loth\.css$/,
  /^html\/ExsurgeChar\.otf$/,
  /^README(\.md)?$/,
  /^LICENSE(\.[A-Za-z]+)?$/,
  /^package\.json$/,
];

const MAX_TARBALL_BYTES = 5 * 1024 * 1024;

const failures = [];

// `.npmignore`, if present, overrides `files` wholesale — a very easy way to
// ship the entire repo while the `files` field still looks correct.
const npmignore = path.join(repoRoot, ".npmignore");
if (fs.existsSync(npmignore)) {
  failures.push(
    ".npmignore exists; it overrides the `files` allowlist. Delete it and rely on `files`.",
  );
}

const raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
});

/**
 * Find the pack report, whatever npm decided to wrap it in this major.
 *
 * npm <= 11 prints `[ {report} ]`; npm 12 prints `{ "<name>": {report} }`. The
 * report itself is unchanged, so only the unwrapping is version-dependent.
 *
 * Either way the prepack scripts have already written to the same stdout, so
 * the JSON starts somewhere past byte zero and has to be located. "Slice from
 * the first `[`" is what this used to do, and it is wrong under npm 12: the
 * first `[` is the inner `files` array, which parses cleanly on its own and
 * then throws on the trailing keys. Scanning for the first position that parses
 * *into a report* is indifferent to both the noise and the shape.
 */
const parsePackReport = (out) => {
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "[" && out[i] !== "{") continue;
    let doc;
    try {
      doc = JSON.parse(out.slice(i));
    } catch {
      continue;
    }
    const candidate = Array.isArray(doc) ? doc[0] : Object.values(doc)[0];
    if (candidate && Array.isArray(candidate.files)) return candidate;
  }
  throw new Error(
    "no pack report in `npm pack --json` output; npm may have changed its " +
      `shape again. Raw output was:\n${out}`,
  );
};

const report = parsePackReport(raw);
const entries = report.files.map((f) => f.path.replace(/\\/g, "/"));

for (const entry of entries) {
  if (!ALLOWED.some((re) => re.test(entry))) {
    failures.push(`unexpected file in tarball: ${entry}`);
  }
}

if (report.size > MAX_TARBALL_BYTES) {
  failures.push(
    `tarball is ${(report.size / 1024 / 1024).toFixed(1)} MB, over the ` +
      `${MAX_TARBALL_BYTES / 1024 / 1024} MB ceiling — that size means data got in`,
  );
}

if (!entries.some((e) => e === "dist/index.js")) {
  failures.push("dist/index.js is missing; run `npm run build` before packing");
}

/**
 * Every path the manifest promises must actually be in the tarball.
 *
 * 0.2.0 shipped with `exports[*].types` pointing at .d.ts files that were
 * never emitted, because tsconfig lacked `declaration`. Consumers saw the
 * whole package as implicit-any and npm gave no warning — nothing validates
 * an `exports` map against its own tarball, so this does.
 */
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const declared = new Set();

const collect = (value) => {
  if (typeof value === "string") {
    if (value.startsWith("./")) declared.add(value.slice(2));
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collect(v);
  }
};
collect(pkg.exports);
collect(pkg.main);
collect(pkg.types);

const present = new Set(entries);
for (const target of [...declared].sort()) {
  if (target === "package.json") continue;
  if (!present.has(target)) {
    failures.push(`package.json points at "${target}", which is not in the tarball`);
  }
}

if (failures.length > 0) {
  console.error("Refusing to publish:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\n${entries.length} files, ${(report.size / 1024).toFixed(0)} KB total.`);
  process.exit(1);
}

console.log(
  `tarball OK: ${entries.length} files, ${(report.size / 1024).toFixed(0)} KB, code only.`,
);
