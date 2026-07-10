/**
 * Validates data/ completeness. Run: npm run validate:data
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataRoot = path.join(repoRoot, "data");
const defaultLocale = "en";
const dataDir = path.join(dataRoot, defaultLocale);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYTIME_HOURS = ["terce", "sext", "none"];

const FIX = process.argv.includes("--fix");

const SEASONS = new Set([
  "advent", "christmas", "ordinary_time", "lent",
  "holy_week", "easter_triduum", "eastertide",
]);
const DAY_CLASSES = new Set([
  "triduum", "sunday", "solemnity", "feast_of_lord_on_sunday", "feast",
  "obligatory_memoria", "optional_memoria", "privileged_ferial", "ordinary_ferial",
]);
const SUNDAY_CYCLES = new Set(["A", "B", "C"]);
const CONDITION_KEYS = new Set(["seasons", "day_classes", "sunday_cycles", "weekdays", "date_range"]);
const PART_KEYS = new Set([
  "antiphon", "antiphon_paschal", "psalm_tone", "first_verse",
  "responsory", "responsory_second", "versicle", "gloria",
]);

async function loadDistModule(relPath) {
  const href = new URL(`../dist/${relPath}`, import.meta.url).href;
  return import(href);
}

function collectTextIds(obj, psalms, canticles) {
  if (Array.isArray(obj)) {
    for (const x of obj) collectTextIds(x, psalms, canticles);
    return;
  }
  if (obj && typeof obj === "object") {
    if (typeof obj.psalm_or_canticle_id === "string") {
      const id = obj.psalm_or_canticle_id;
      if (id.startsWith("psalm_")) psalms.add(id);
      else canticles.add(id);
    }
    for (const v of Object.values(obj)) collectTextIds(v, psalms, canticles);
  }
}

// ---------------------------------------------------------------------------
// Melody store + melody_refs validation (per locale with a melodies/ dir)
// ---------------------------------------------------------------------------

async function collectYamlFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectYamlFiles(p)));
    else if (e.name.endsWith(".yaml") || e.name.endsWith(".yml")) out.push(p);
  }
  return out;
}

function validateCondition(cond, where, errors) {
  if (cond === null || cond === undefined) return;
  for (const key of Object.keys(cond)) {
    if (!CONDITION_KEYS.has(key)) errors.push(`${where}: unknown condition key "${key}"`);
  }
  for (const s of cond.seasons ?? []) {
    if (!SEASONS.has(s)) errors.push(`${where}: unknown season "${s}"`);
  }
  for (const d of cond.day_classes ?? []) {
    if (!DAY_CLASSES.has(d)) errors.push(`${where}: unknown day class "${d}"`);
  }
  for (const c of cond.sunday_cycles ?? []) {
    if (!SUNDAY_CYCLES.has(c)) errors.push(`${where}: unknown sunday cycle "${c}"`);
  }
  for (const w of cond.weekdays ?? []) {
    if (!WEEKDAYS.includes(w)) errors.push(`${where}: unknown weekday "${w}"`);
  }
  if (cond.date_range) {
    for (const bound of ["from", "to"]) {
      const v = cond.date_range[bound];
      if (!/^\d{2}-\d{2}$/.test(v ?? "")) {
        errors.push(`${where}: date_range.${bound} is not "MM-DD": ${v}`);
      }
    }
  }
}

/** Walk parsed YAML for melody_refs lists; call visit(refs, where). */
function walkMelodyRefs(node, where, visit) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkMelodyRefs(v, `${where}[${i}]`, visit));
    return;
  }
  if (node && typeof node === "object") {
    if (Array.isArray(node.melody_refs)) visit(node.melody_refs, where);
    for (const [k, v] of Object.entries(node)) {
      if (k === "melody_refs") continue;
      walkMelodyRefs(v, `${where}.${k}`, visit);
    }
  }
}

async function validateMelodies(localeDir, locale, errors, warnings) {
  const yaml = (await import("js-yaml")).default;
  const melodiesDir = path.join(localeDir, "melodies");

  // --- Store integrity ---
  const byId = new Map();
  const aliasToId = new Map();
  const idByHash = new Map();
  for (const file of await collectYamlFiles(melodiesDir)) {
    const entries = yaml.load(await fs.readFile(file, "utf-8")) ?? [];
    for (const m of entries) {
      const where = `${locale}/melodies/${path.basename(file)}#${m.id}`;
      if (byId.has(m.id)) errors.push(`${where}: duplicate melody id`);
      byId.set(m.id, m);
      if (!m.content_hash) errors.push(`${where}: missing content_hash`);
      else idByHash.set(m.content_hash, m.id);
      for (const alias of m.aliases ?? []) aliasToId.set(alias, m.id);
      for (const k of Object.keys(m.parts ?? {})) {
        if (!PART_KEYS.has(k)) errors.push(`${where}: unknown part key "${k}"`);
      }
      if (!m.gabc && !m.parts) errors.push(`${where}: neither gabc nor parts present`);
    }
  }
  if (byId.size === 0) return; // no store for this locale

  // --- Refs in the data tree ---
  const fixups = new Map(); // file -> [{from, to}]
  for (const file of await collectYamlFiles(localeDir)) {
    if (file.startsWith(melodiesDir)) continue;
    const rel = `${locale}/${path.relative(localeDir, file).split(path.sep).join("/")}`;
    let doc;
    try {
      doc = yaml.load(await fs.readFile(file, "utf-8"));
    } catch (e) {
      errors.push(`${rel}: YAML parse error: ${e.message}`);
      continue;
    }
    walkMelodyRefs(doc, rel, (refs, where) => {
      let sawUnconditioned = false;
      let sawConditioned = false;
      refs.forEach((r, i) => {
        const spot = `${where}.melody_refs[${i}]`;
        if (typeof r?.ref !== "string" || !r.ref) {
          errors.push(`${spot}: missing ref id`);
          return;
        }
        validateCondition(r.condition, spot, errors);
        if (r.condition) sawConditioned = true;
        else {
          if (sawUnconditioned && !r.note) {
            warnings.push(`${spot}: unreachable — follows an unconditioned ref and is not marked as an alternative`);
          }
          sawUnconditioned = true;
        }
        if (byId.has(r.ref)) return;
        if (aliasToId.has(r.ref)) {
          const canonical = aliasToId.get(r.ref);
          warnings.push(`${spot}: ref "${r.ref}" is a duplicate alias of "${canonical}"${FIX ? " (fixing)" : ""}`);
          if (FIX) {
            if (!fixups.has(file)) fixups.set(file, []);
            fixups.get(file).push({ from: r.ref, to: canonical });
          }
          return;
        }
        errors.push(`${spot}: dangling melody ref "${r.ref}"`);
      });
      if (sawConditioned && !sawUnconditioned) {
        warnings.push(`${where}: only conditioned melody refs — no default for the rest of the year`);
      }
    });
  }

  for (const [file, subs] of fixups) {
    let text = await fs.readFile(file, "utf-8");
    for (const { from, to } of subs) {
      text = text.split(`ref: ${from}`).join(`ref: ${to}`);
    }
    await fs.writeFile(file, text, "utf-8");
    console.log(`  fixed ${subs.length} ref(s) in ${path.relative(repoRoot, file)}`);
  }
}

/** Daytime proper antiphons must be a single antiphon or one per psalm (GILH 122). */
async function validateDaytimeAntiphons(localeDir, locale, errors) {
  const yaml = (await import("js-yaml")).default;
  const dirs = ["proper_of_seasons", "proper_of_saints", "commons"];
  for (const dir of dirs) {
    for (const file of await collectYamlFiles(path.join(localeDir, dir))) {
      const rel = `${locale}/${dir}/${path.basename(file)}`;
      let doc;
      try {
        doc = yaml.load(await fs.readFile(file, "utf-8"));
      } catch {
        continue; // parse errors surfaced elsewhere
      }
      // Commons wrap the hours in variants[]; normalise to a list of hour-holders.
      const holders = Array.isArray(doc?.variants) ? doc.variants : [doc];
      for (const holder of holders) {
        for (const hour of ["terce", "sext", "none"]) {
          const ant = holder?.[hour]?.antiphons;
          if (ant === undefined) continue;
          if (!Array.isArray(ant) || (ant.length !== 1 && ant.length !== 3)) {
            errors.push(`${rel}: ${hour}.antiphons must have length 1 or 3 (got ${Array.isArray(ant) ? ant.length : typeof ant})`);
          }
        }
      }
    }
  }
}

async function main() {
  const errors = [];
  const { DataRepository } = await loadDistModule("data/repository.js");
  const { buildDay } = await loadDistModule("hours/index.js");
  const { resolveDay, defaultContext, SanctoralCalendarRegistry } = await loadDistModule("calendar/index.js");
  const { initSanctoralRegistry } = await loadDistModule("calendar/saints.js");
  const { PlainTextAssembler } = await loadDistModule("assemblers/plainText.js");
  const { resolvePsalmText } = await loadDistModule("assemblers/liturgicalText.js");

  const registry = await SanctoralCalendarRegistry.load(dataRoot, defaultLocale);
  initSanctoralRegistry(registry);

  const repo = await DataRepository.load(dataRoot, defaultLocale);

  if (!repo.getFixedTexts()) {
    errors.push("fixed_texts.yaml did not load");
  }

  try {
    const labels = repo.getAssemblerLabels();
    const required = [
      labels.hours.officeOfReadings,
      labels.hours.lauds,
      labels.sections.benedictus,
      labels.rubrics.letUsPray,
      labels.rubrics.antiphonPrefix,
    ];
    for (const s of required) {
      if (!s?.trim()) errors.push("assembler labels contain empty required string");
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  for (const kind of ["benedictus", "magnificat", "nuncDimittis"]) {
    if (!repo.getGospelCanticle(kind)) {
      errors.push(`missing gospel canticle: ${kind}`);
    }
  }

  const psalmFiles = new Set(
    (await fs.readdir(path.join(dataDir, "psalms")))
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, "")),
  );
  const canticleFiles = new Set(
    (await fs.readdir(path.join(dataDir, "canticles")))
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, "")),
  );

  for (const locale of ["en", "sv"]) {
    const fp = path.join(dataRoot, locale, "psalms", "psalm_unassigned.yaml");
    try {
      await fs.access(fp);
    } catch {
      errors.push(`missing sentinel psalm: ${locale}/psalms/psalm_unassigned.yaml`);
    }
  }

  for (let week = 1; week <= 4; week++) {
    for (const day of WEEKDAYS) {
      const key = `week${week}_${day.toLowerCase()}`;
      const dayPath = path.join(dataDir, "psalter", `${key}.yaml`);
      try {
        await fs.access(dayPath);
      } catch {
        errors.push(`missing psalter file: ${key}.yaml`);
      }
    }
  }

  const psalterDays = await fs.readdir(path.join(dataDir, "psalter"));
  const referencedPsalms = new Set();
  const referencedCanticles = new Set();
  for (const f of psalterDays.filter((x) => x.endsWith(".yaml"))) {
    const content = await fs.readFile(path.join(dataDir, "psalter", f), "utf-8");
    const yaml = await import("js-yaml").then((m) => m.default.load(content));
    collectTextIds(yaml, referencedPsalms, referencedCanticles);
  }

  for (const id of referencedPsalms) {
    if (!psalmFiles.has(id)) errors.push(`missing psalm file: ${id}`);
  }
  for (const id of referencedCanticles) {
    if (!canticleFiles.has(id)) errors.push(`missing canticle file: ${id}`);
  }

  for (const day of WEEKDAYS) {
    for (const hour of DAYTIME_HOURS) {
      const gid = `complementary_${day.toLowerCase()}_${hour}`;
      if (!repo.getComplementaryGroup(gid)) {
        errors.push(`missing complementary group: ${gid}`);
      }
    }
  }

  const sampleDate = new Date("2026-05-10T00:00:00Z");
  const liturgicalDay = resolveDay(sampleDate, "general");
  const abs = buildDay(liturgicalDay, defaultContext());
  const text = new PlainTextAssembler().assembleDay(abs, repo);
  if (text.includes("— text not loaded]")) {
    errors.push("sample assembly contains unresolved psalm/canticle ids");
  }
  if (text.includes("[Te Deum text]") || text.includes("[Benedictus text —")) {
    errors.push("sample assembly still contains legacy hardcoded placeholders");
  }

  for (const slot of abs.lauds.psalmSlots) {
    const { resolvePsalmAssignment } = await loadDistModule("assemblers/types.js");
    const a = resolvePsalmAssignment(slot.assignmentRef, repo);
    if (a) {
      const t = resolvePsalmText(a.psalmOrCanticleId, repo);
      if (t.includes("text not loaded")) {
        errors.push(`lauds psalm not loaded: ${a.psalmOrCanticleId}`);
      }
    }
  }

  const { getSeasonalDayKey } = await loadDistModule("calendar/liturgicalYear.js");
  const seasonalKeys = new Set();
  for (let y = 2024; y <= 2028; y++) {
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const key = getSeasonalDayKey(new Date(Date.UTC(y, m, d)), "general");
        if (key) seasonalKeys.add(key);
      }
    }
  }

  for (const key of seasonalKeys) {
    const fp = path.join(dataDir, "proper_of_seasons", `${key}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      errors.push(`missing proper_of_seasons: ${key}.yaml`);
    }
  }

  // Melody stores + melody_refs, for every locale that has one.
  const warnings = [];
  for (const localeEntry of await fs.readdir(dataRoot, { withFileTypes: true })) {
    if (!localeEntry.isDirectory()) continue;
    const localeDir = path.join(dataRoot, localeEntry.name);
    await validateMelodies(localeDir, localeEntry.name, errors, warnings);
    await validateDaytimeAntiphons(localeDir, localeEntry.name, errors);
  }
  if (warnings.length > 0) {
    console.warn("validate:data warnings:\n" + warnings.map((w) => `  - ${w}`).join("\n"));
  }

  if (errors.length > 0) {
    console.error("validate:data failed:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }
  console.log(`validate:data OK (${referencedPsalms.size} psalms, ${referencedCanticles.size} canticles, ${seasonalKeys.size} seasonal keys)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
