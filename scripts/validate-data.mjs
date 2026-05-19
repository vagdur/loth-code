/**
 * Validates data/ completeness. Run: npm run validate:data
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "data");

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYTIME_HOURS = ["terce", "sext", "none"];

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

async function main() {
  const errors = [];
  const { DataRepository } = await loadDistModule("data/repository.js");
  const { buildDay } = await loadDistModule("hours/index.js");
  const { resolveDay, defaultContext, SanctoralCalendarRegistry } = await loadDistModule("calendar/index.js");
  const { initSanctoralRegistry } = await loadDistModule("calendar/saints.js");
  const { PlainTextAssembler } = await loadDistModule("assemblers/plainText.js");
  const { resolvePsalmText } = await loadDistModule("assemblers/liturgicalText.js");

  const registry = await SanctoralCalendarRegistry.load(dataDir);
  initSanctoralRegistry(registry);

  const repo = await DataRepository.load(dataDir);

  if (!repo.getFixedTexts()) {
    errors.push("fixed_texts.yaml did not load");
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
