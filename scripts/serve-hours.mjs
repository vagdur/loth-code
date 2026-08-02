/**
 * Serve the HTML hours locally, to check the chant renders and plays.
 *
 *   npm run serve:hours
 *   npm run serve:hours -- --port 8080 --locale sv
 *
 * With `?debug=1`, each score that came from the melody store gets a link to
 * its page in the KLN GABC validator (`scripts/validate-kln-gabc.py`, default
 * http://127.0.0.1:5000). Override with `--validator-url`.
 *
 * This is host-a-site infrastructure and deliberately lives outside the
 * package: everything under src/ does is produce markup (HtmlAssembler) and
 * mount the scores (src/browser/lothChant.ts). The picker header and the speed
 * slider below are what a host would build for itself — they exist here to
 * prove the runtime handles are usable, not because the package ships controls.
 *
 * Node's own http/fs only; no dependencies.
 */

import { createServer } from "http";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { loadSanctoralRegistry } from "../dist/calendar/sanctoralRegistryNode.js";
import { initSanctoralRegistry } from "../dist/calendar/saints.js";
import { defaultContext, resolveDay, utcDate } from "../dist/calendar/index.js";
import { loadRepository } from "../dist/data/repositoryNode.js";
import { buildDay, eveningVespers } from "../dist/hours/index.js";
import { HtmlAssembler } from "../dist/assemblers/htmlAssembler.js";
import { exsurgeDir, exsurgeFontPath } from "../dist/tools/htmlAssets.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(repoRoot, "data");
const splitRoot = path.join(repoRoot, "raw_data", "kln", "split");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const port = Number(argValue("--port", "5173"));
const host = argValue("--host", "127.0.0.1");
const defaultLocale = argValue("--locale", "sv");
const defaultCalendar = argValue("--calendar", "general");
const validatorUrl = (argValue("--validator-url", "http://127.0.0.1:5000")).replace(/\/$/, "");

// --- Fail fast on a missing build or a missing install --------------------

const RUNTIME_PATH = path.join(repoRoot, "dist", "browser", "lothChant.js");
const CSS_PATH = path.join(repoRoot, "html", "loth.css");

let EXSURGE_DIR;
try {
  EXSURGE_DIR = exsurgeDir();
} catch {
  console.error("@vagdur/exsurge not found. Run `npm install` first.");
  process.exit(1);
}

for (const [label, file] of [
  ["browser runtime", RUNTIME_PATH],
  ["exsurge module", path.join(EXSURGE_DIR, "dist", "exsurge.mjs")],
  ["stylesheet", CSS_PATH],
]) {
  try {
    await fs.access(file);
  } catch {
    console.error(`${label} not found: ${file}`);
    console.error("Run `npm run build` first: the page is rendered in the browser.");
    process.exit(1);
  }
}

// --- Assembly -------------------------------------------------------------

const HOURS = [
  "day", "officeOfReadings", "lauds", "terce", "sext", "none", "vespers", "compline",
];
const MODES = ["hybrid", "plain", "scored"];

/** Cache one repo per locale; loading the YAML bundles takes about a second. */
const repos = new Map();
async function repoFor(locale) {
  let repo = repos.get(locale);
  if (!repo) {
    repo = await loadRepository(dataRoot, locale);
    repos.set(locale, repo);
  }
  return repo;
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return new Date();
  return utcDate(Number(m[1]), Number(m[2]), Number(m[3]));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Map store melody ids (`kln/<split_rel>/<filename-slug>`) to validator paths
 * (`<split_rel>/<index>`). Same id scheme as scripts/compile-melody-store.mjs.
 */
async function loadMelodyValidateMap() {
  const map = new Map();
  let entries;
  try {
    entries = await fs.readdir(splitRoot, { withFileTypes: true, recursive: true });
  } catch {
    console.warn(`KLN split tree not found at ${splitRoot}; debug validate links disabled.`);
    return map;
  }
  for (const ent of entries) {
    if (!ent.isFile() || ent.name !== "index.json") continue;
    // Node recursive readdir: ent.parentPath (newer) or ent.path (older).
    const dir = ent.parentPath ?? ent.path;
    const idxPath = path.join(dir, ent.name);
    const relDir = path.relative(splitRoot, dir).split(path.sep).join("/");
    let idx;
    try {
      idx = JSON.parse(await fs.readFile(idxPath, "utf8"));
    } catch {
      continue;
    }
    (idx.melodies ?? []).forEach((melody, i) => {
      const slug = String(melody.filename ?? `melody-${i}`)
        .replace(/\.pdf$/i, "")
        .toLowerCase();
      // Same notion of "unvetted" as validate-kln-gabc.py (null/absent status).
      map.set(`kln/${relDir}/${slug}`, {
        path: `${relDir}/${i}`,
        unreviewed: !melody.manual_status,
      });
    });
  }
  return map;
}

/** Insert a "validate" link before each score mount that carries a store id. */
function injectValidateLinks(html, hrefByMelodyId) {
  return html.replace(
    /<div class="loth-score\b[^"]*"[^>]*\bdata-melody-id="([^"]+)"[^>]*><\/div>/g,
    (match, melodyId) => {
      const entry = hrefByMelodyId.get(melodyId);
      if (!entry) return match;
      const href = `${validatorUrl}/melody/${entry.path}`;
      const cls = entry.unreviewed
        ? "loth-validate loth-validate-unreviewed"
        : "loth-validate";
      const label = entry.unreviewed ? "edit in validator (unreviewed)" : "edit in validator";
      return `<p class="${cls}"><a href="${escapeHtml(href)}" target="_blank" rel="noopener" title="${escapeHtml(melodyId)}">${label}</a></p>\n  ${match}`;
    },
  );
}

function renderHour(assembler, day, repo, hour) {
  switch (hour) {
    case "day": return assembler.assembleDay(day, repo);
    case "officeOfReadings": return assembler.assembleOfficeOfReadings(day.officeOfReadings, repo);
    case "lauds": return assembler.assembleLauds(day.lauds, repo);
    case "terce": case "sext": case "none": {
      const h = day[hour];
      if (!h) return `<p class="loth-prose">No ${hour} on this day.</p>`;
      return assembler.assembleDaytimePrayer(h, repo);
    }
    case "vespers": return assembler.assembleVespers(eveningVespers(day), repo);
    case "compline": return assembler.assembleCompline(day.compline, repo);
    default: return `<p class="loth-prose">Unknown hour "${hour}".</p>`;
  }
}

function option(value, current, label) {
  const selected = value === current ? " selected" : "";
  return `<option value="${value}"${selected}>${label ?? value}</option>`;
}

/**
 * The demo chrome: pickers, plus a speed slider driving every player's
 * `setSpeed`. Illustrates the intended host pattern — take the handles
 * `mountScores` returns and build whatever interface you want.
 */
function headerHtml({ date, locale, hour, mode, calendar, debug }) {
  const debugChecked = debug ? " checked" : "";
  return `<header class="demo-bar">
  <form method="get">
    <label>Date <input type="date" name="date" value="${date}"></label>
    <label>Hour <select name="hour">${HOURS.map((h) => option(h, hour)).join("")}</select></label>
    <label>Locale <select name="locale">${["sv", "en"].map((l) => option(l, locale)).join("")}</select></label>
    <label>Mode <select name="mode">${MODES.map((m) => option(m, mode)).join("")}</select></label>
    <label class="demo-debug"><input type="checkbox" name="debug" value="1"${debugChecked}> Debug</label>
    <input type="hidden" name="calendar" value="${calendar}">
    <button type="submit">Show</button>
  </form>
  <label class="demo-speed">Speed <input type="range" id="speed" min="40" max="200" value="100"><output id="speed-out">100%</output></label>
  <p class="demo-hint">Click a note to play from there; click again to stop.${
    debug
      ? ` Scores link to the <a href="${escapeHtml(validatorUrl)}/" target="_blank" rel="noopener">validator</a>.`
      : ""
  }</p>
</header>
<style>
  .demo-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap;
    gap: .75rem 1.25rem; align-items: center; margin: -2rem -1.25rem 2rem;
    padding: .75rem 1.25rem; background: #fff; border-bottom: 1px solid #d8d4cc;
    font-family: system-ui, sans-serif; font-size: .85rem; }
  .demo-bar form { display: flex; flex-wrap: wrap; gap: .75rem; align-items: center; }
  .demo-bar label { display: flex; gap: .35rem; align-items: center; }
  .demo-hint { margin: 0; color: #5a5a5a; }
  .demo-hint a { color: inherit; }
  .loth-validate { margin: .35rem 0 0; font-family: system-ui, sans-serif; font-size: .75rem; }
  .loth-validate a { color: #6b5b4a; text-decoration: none; border-bottom: 1px dotted currentColor; }
  .loth-validate a:hover { color: #3d3429; }
  .loth-validate-unreviewed a { color: #c45c12; font-weight: 600; }
  .loth-validate-unreviewed a:hover { color: #9a470e; }
</style>`;
}

/** Mount, then wire the slider to the players — the host-side half of the demo. */
const FOOTER_SCRIPT = `<script type="module">
import { mountScores } from "/dist/browser/lothChant.js";

const scores = mountScores(document);
window.lothScores = scores; // handy from the devtools console

const slider = document.getElementById("speed");
const out = document.getElementById("speed-out");
slider.addEventListener("input", () => {
  out.value = slider.value + "%";
  for (const score of scores) score.player?.setSpeed(Number(slider.value));
});

const players = await Promise.all(scores.map((s) => s.ready.catch(() => null)));
console.log(\`mounted \${players.filter(Boolean).length}/\${scores.length} scores\`);
</script>`;

async function buildPage(params) {
  const repo = await repoFor(params.locale);
  const liturgicalDay = resolveDay(parseDate(params.date), params.calendar);
  const abstractDay = buildDay(liturgicalDay, defaultContext(params.calendar));

  const assembler = new HtmlAssembler({
    outputMode: params.mode,
    document: {
      title: `LoTH — ${params.hour} ${params.date}`,
      cssHref: "/loth.css",
      exsurgeUrl: "/vendor/exsurge/dist/exsurge.mjs",
      runtimeUrl: "/dist/browser/lothChant.js",
      // The footer script mounts, so the page does not need the default
      // bootstrap; two mounts of the same element would be a no-op anyway.
      mountScores: false,
      headerHtml: headerHtml(params),
      footerHtml: FOOTER_SCRIPT,
    },
  });

  let html = renderHour(assembler, abstractDay, repo, params.hour);
  if (params.debug && melodyValidateMap.size > 0) {
    html = injectValidateLinks(html, melodyValidateMap);
  }
  return html;
}

// --- Static files ---------------------------------------------------------

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".otf": "font/otf",
  ".ttf": "font/ttf",
};

async function sendFile(res, file) {
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}

/** Resolve `subpath` inside `root`, refusing anything that escapes it. */
function containedPath(root, subpath) {
  const target = path.resolve(root, "." + path.posix.resolve("/", subpath));
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

// --- Server ---------------------------------------------------------------

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const { pathname, searchParams } = url;

  try {
    if (pathname === "/loth.css") return void (await sendFile(res, CSS_PATH));

    // loth.css declares @font-face with a relative url, so the font has to sit
    // next to the stylesheet — copyLothCss does the same when writing to disk.
    if (pathname === "/ExsurgeChar.otf") {
      return void (await sendFile(res, exsurgeFontPath()));
    }

    if (pathname.startsWith("/vendor/exsurge/")) {
      const file = containedPath(EXSURGE_DIR, pathname.slice("/vendor/exsurge".length));
      if (!file) return void res.writeHead(404).end("not found");
      return void (await sendFile(res, file));
    }

    if (pathname.startsWith("/dist/")) {
      const file = containedPath(path.join(repoRoot, "dist"), pathname.slice("/dist".length));
      if (!file) return void res.writeHead(404).end("not found");
      return void (await sendFile(res, file));
    }

    if (pathname !== "/") return void res.writeHead(404).end("not found");

    const params = {
      date: searchParams.get("date") || isoDate(new Date()),
      locale: searchParams.get("locale") || defaultLocale,
      hour: HOURS.includes(searchParams.get("hour")) ? searchParams.get("hour") : "lauds",
      mode: MODES.includes(searchParams.get("mode")) ? searchParams.get("mode") : "hybrid",
      calendar: searchParams.get("calendar") || defaultCalendar,
      debug: searchParams.get("debug") === "1" || searchParams.get("debug") === "true",
    };

    const html = await buildPage(params);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
    res.end(html);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error?.stack ?? error));
  }
});

const registry = await loadSanctoralRegistry(dataRoot, defaultLocale);
initSanctoralRegistry(registry);

const melodyValidateMap = await loadMelodyValidateMap();

server.listen(port, host, () => {
  console.log(`LoTH hours: http://${host}:${port}/`);
  console.log(`  locale=${defaultLocale} calendar=${defaultCalendar}`);
  console.log("  query params: date, hour, locale, mode, calendar, debug");
  if (melodyValidateMap.size > 0) {
    console.log(`  debug validate links → ${validatorUrl}/melody/… (${melodyValidateMap.size} melodies)`);
  }
});
