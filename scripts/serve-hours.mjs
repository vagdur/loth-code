/**
 * Serve the HTML hours locally, to check the chant renders and plays.
 *
 *   npm run serve:hours
 *   npm run serve:hours -- --port 8080 --locale en
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

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const port = Number(argValue("--port", "5173"));
const host = argValue("--host", "127.0.0.1");
const defaultLocale = argValue("--locale", "en");
const defaultCalendar = argValue("--calendar", "general");

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
/** Locale bundles under `data/`, so the picker offers whatever this tree has. */
const LOCALES = (await fs.readdir(dataRoot, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

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
function headerHtml({ date, locale, hour, mode, calendar }) {
  return `<header class="demo-bar">
  <form method="get">
    <label>Date <input type="date" name="date" value="${date}"></label>
    <label>Hour <select name="hour">${HOURS.map((h) => option(h, hour)).join("")}</select></label>
    <label>Locale <select name="locale">${LOCALES.map((l) => option(l, locale)).join("")}</select></label>
    <label>Mode <select name="mode">${MODES.map((m) => option(m, mode)).join("")}</select></label>
    <input type="hidden" name="calendar" value="${calendar}">
    <button type="submit">Show</button>
  </form>
  <label class="demo-speed">Speed <input type="range" id="speed" min="40" max="200" value="100"><output id="speed-out">100%</output></label>
  <p class="demo-hint">Click a note to play from there; click again to stop.</p>
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

  return renderHour(assembler, abstractDay, repo, params.hour);
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

server.listen(port, host, () => {
  console.log(`LoTH hours: http://${host}:${port}/`);
  console.log(`  locale=${defaultLocale} calendar=${defaultCalendar}`);
  console.log("  query params: date, hour, locale, mode, calendar");
});
