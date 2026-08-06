/**
 * Generates psalter, psalm/canticle stubs, complementary psalmody,
 * and seasonal proper OoR stubs.
 *
 * Run: node scripts/generate-data.mjs [--locale <loc>]     (default: en)
 * For a non-en locale, fixed_texts.yaml and calendars/ are seeded as copies
 * of the en versions when absent (to be translated in place).
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const locale = argValue("--locale", "en");
const dataDir = path.join(repoRoot, "data", locale);

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PS118 = [
  "i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x",
  "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx", "xxi", "xxii",
];

const OT_CANTICLES = [
  "ot_dn3_glory", "ot_is38", "ot_is12", "ot_1chr29", "ot_hab3", "ot_is45", "ot_mi7",
];
const NT_CANTICLES = [
  "nt_phil2", "nt_col1", "nt_1tim3", "nt_1jn4", "nt_eph1", "nt_apoc12", "nt_apoc15",
];

/** Sentinel psalm id for an antiphon whose psalm the source does not record. */
const PSALM_UNASSIGNED = "psalm_unassigned";

/** Lauds morning psalm, praise psalm per week (rows) × day (cols). */
const LAUDS_MORNING = [
  ["psalm_62", "psalm_143", "psalm_25", "psalm_36", "psalm_51", "psalm_147", "psalm_92"],
  ["psalm_63", "psalm_89", "psalm_26", "psalm_38", "psalm_52", "psalm_147", "psalm_95"],
  ["psalm_64", "psalm_101", "psalm_27", "psalm_39", "psalm_53", "psalm_147", "psalm_96"],
  ["psalm_65", "psalm_143", "psalm_28", "psalm_40", "psalm_54", "psalm_147", "psalm_97"],
];
const LAUDS_PRAISE = [
  ["psalm_148", "psalm_150", "psalm_149", "psalm_149", "psalm_149", "psalm_149", "psalm_149"],
  ["psalm_149", "psalm_150", "psalm_148", "psalm_148", "psalm_148", "psalm_148", "psalm_148"],
  ["psalm_150", "psalm_149", "psalm_150", "psalm_150", "psalm_150", "psalm_150", "psalm_150"],
  ["psalm_148", "psalm_148", "psalm_149", "psalm_149", "psalm_149", "psalm_149", "psalm_150"],
];

const OOR_PSALMS = [
  ["psalm_94", "psalm_22", "psalm_62"],
  ["psalm_99", "psalm_23", "psalm_66"],
  ["psalm_100", "psalm_24", "psalm_67"],
  ["psalm_92", "psalm_8", "psalm_63"],
];

/** Ferial Compline psalms per weekday (LXX numbering; Wednesday has two). */
const COMPLINE_FERIAL_PSALMS = {
  Sunday: ["psalm_90"],
  Monday: ["psalm_85"],
  Tuesday: ["psalm_142"],
  Wednesday: ["psalm_30", "psalm_129"],
  Thursday: ["psalm_15"],
  Friday: ["psalm_87"],
  Saturday: ["psalm_90"],
};

/** Sunday First Vespers psalmody per week (LXX numbering; canticle always Phil 2). */
const FIRST_VESPERS_PSALMS = [
  ["psalm_140", "psalm_141", "nt_phil2"],
  ["psalm_118_xiv", "psalm_15", "nt_phil2"],
  ["psalm_112", "psalm_115", "nt_phil2"],
  ["psalm_121", "psalm_129", "nt_phil2"],
];

const VESPERS_PSALMS = [
  [["psalm_109", "psalm_110"], ["psalm_5", "psalm_29"], ["psalm_11", "psalm_15"], ["psalm_18", "psalm_21"], ["psalm_24", "psalm_25"], ["psalm_30", "psalm_31"], ["psalm_45", "psalm_46"]],
  [["psalm_104", "psalm_105"], ["psalm_47", "psalm_48"], ["psalm_49", "psalm_50"], ["psalm_55", "psalm_56"], ["psalm_57", "psalm_58"], ["psalm_59", "psalm_60"], ["psalm_61", "psalm_62"]],
  [["psalm_109", "psalm_110"], ["psalm_71", "psalm_72"], ["psalm_73", "psalm_74"], ["psalm_75", "psalm_76"], ["psalm_77", "psalm_78"], ["psalm_79", "psalm_80"], ["psalm_81", "psalm_82"]],
  [["psalm_104", "psalm_105"], ["psalm_83", "psalm_84"], ["psalm_85", "psalm_86"], ["psalm_87", "psalm_88"], ["psalm_89", "psalm_90"], ["psalm_91", "psalm_92"], ["psalm_93", "psalm_94"]],
];

// Replace omitted psalms in vespers table
function safePsalmId(id) {
  const omitted = new Set(["psalm_57", "psalm_82", "psalm_108"]);
  if (!omitted.has(id)) return id;
  return "psalm_90";
}

function ps118Id(index) {
  const r = PS118[index % PS118.length];
  return `psalm_118_${r}`;
}

function stubAntiphon(label) {
  return { text: `[${label}]` };
}

function stubHymn(label) {
  return {
    stanzas: [`[${label}, stanza 1]`, `[${label}, stanza 2]`],
    doxology: `[${label}, doxology]`,
  };
}

function stubReading(ref) {
  return { reference: ref, text: `[Short reading: ${ref}]` };
}

function stubIntercessions(hour) {
  return {
    introduction: `[${hour} intercessions introduction]`,
    response: "Lord, have mercy.",
    intentions: [
      { first_part: "[Intention 1]", second_part: "[Response 1]" },
      { first_part: "[Intention 2]", second_part: "[Response 2]" },
      { first_part: "[Intention 3]", second_part: "[Response 3]" },
    ],
  };
}

function buildPsalterDay(week, dayName) {
  const d = WEEKDAYS.indexOf(dayName);
  const w = week - 1;
  const label = `Week ${week} ${dayName}`;
  const dayIdx = d;
  const sectionBase = w * 21 + d * 3;

  /**
   * Melody refs into `data/en/melodies/sample.yaml`, on the one psalter day
   * the fixtures render (Week 2 Sunday). The `en` bundle is the test fixture,
   * and this is what puts chant into it; a real locale gets its refs from its
   * own extraction pipeline instead, so nothing is attached elsewhere.
   *
   * Entries may be `"id"` or `["id", condition]` — a conditioned ref wins only
   * on a matching day, which is how a season gets its own setting.
   */
  const isSampleDay = locale === "en" && week === 2 && dayName === "Sunday";
  const refs = (...entries) =>
    isSampleDay
      ? {
          melody_refs: entries.map((e) =>
            Array.isArray(e) ? { ref: e[0], condition: e[1] } : { ref: e },
          ),
        }
      : {};

  const psalmSlot = (id, ant, ...melodyRefs) => ({
    psalm_or_canticle_id: safePsalmId(id),
    antiphon: { ...stubAntiphon(ant), ...refs(...melodyRefs) },
  });

  const daytimeHour = (hour) => ({
    hymn: { ...stubHymn(`${label} ${hour} hymn`), ...refs("en/sample/hymn") },
    psalm_assignments: [
      psalmSlot(ps118Id(sectionBase), `${hour} psalm 1`, "en/sample/antiphon-1"),
      psalmSlot(ps118Id(sectionBase + 1), `${hour} psalm 2`, "en/sample/antiphon-2"),
      psalmSlot(ps118Id(sectionBase + 2), `${hour} psalm 3`, "en/sample/antiphon-3"),
    ],
    short_reading: stubReading(`${hour} reading`),
    versicle: {
      verse: `[${hour} versicle]`,
      response: `[${hour} versicle response]`,
    },
    concluding_prayer: { text: `[${label} ${hour} concluding prayer]` },
  });

  const laudsMorning = LAUDS_MORNING[w][d];
  const laudsPraise = LAUDS_PRAISE[w][d];
  const otCanticle = OT_CANTICLES[d];
  const ntCanticle = NT_CANTICLES[d];
  const [vesp1, vesp2] = VESPERS_PSALMS[w][d].map(safePsalmId);
  const oor = OOR_PSALMS[w].map(safePsalmId);

  return {
    week,
    day: dayName,
    invitatory_antiphon: {
      ...stubAntiphon(`${label} invitatory`),
      ...refs("en/sample/invitatory-antiphon"),
    },
    office_of_readings: {
      hymns: {
        night: { ...stubHymn(`${label} OoR night hymn`), ...refs("en/sample/hymn") },
        day: { ...stubHymn(`${label} OoR day hymn`), ...refs("en/sample/hymn") },
      },
      psalm_assignments: [
        psalmSlot(oor[0], "OoR psalm 1", "en/sample/antiphon-1"),
        psalmSlot(oor[1], "OoR psalm 2", "en/sample/antiphon-2"),
        psalmSlot(oor[2], "OoR psalm 3", "en/sample/antiphon-3"),
      ],
      versicle: {
        verse: "Lord, open our lips.",
        response: "And our mouth shall proclaim your praise.",
      },
    },
    lauds: {
      hymns: {
        series_a: { ...stubHymn(`${label} Lauds hymn A`), ...refs("en/sample/hymn") },
        series_b: { ...stubHymn(`${label} Lauds hymn B`), ...refs("en/sample/hymn") },
      },
      psalm_assignments: [
        // Two settings, the first only in Eastertide: the conditioned ref is
        // what exercises condition matching and the melody-choice options.
        psalmSlot(laudsMorning, "Lauds morning psalm",
          ["en/sample/antiphon-1-alt", { seasons: ["eastertide"] }],
          "en/sample/antiphon-1"),
        psalmSlot(otCanticle, "Lauds OT canticle", "en/sample/antiphon-2"),
        psalmSlot(laudsPraise, "Lauds praise psalm", "en/sample/antiphon-3"),
      ],
      short_reading: stubReading("Rev 7:10, 12"),
      short_responsory: {
        text: "[Short responsory]",
        versicle: "[Short responsory versicle]",
        ...refs("en/sample/short-responsory"),
      },
      benedictus_antiphon: {
        ...stubAntiphon(`${label} Benedictus antiphon`),
        ...refs("en/sample/gospel-antiphon"),
      },
      intercessions: stubIntercessions("Lauds"),
      concluding_prayer: { text: `[${label} Lauds concluding prayer]` },
    },
    terce: daytimeHour("Terce"),
    sext: daytimeHour("Sext"),
    none: daytimeHour("None"),
    ...(dayName === "Sunday"
      ? {
          first_vespers: {
            hymns: {
              series_a: { ...stubHymn(`${label} I Vespers hymn A`), ...refs("en/sample/hymn") },
              series_b: { ...stubHymn(`${label} I Vespers hymn B`), ...refs("en/sample/hymn") },
            },
            psalm_assignments: [
              psalmSlot(FIRST_VESPERS_PSALMS[w][0], "I Vespers psalm 1", "en/sample/antiphon-1"),
              psalmSlot(FIRST_VESPERS_PSALMS[w][1], "I Vespers psalm 2", "en/sample/antiphon-2"),
              psalmSlot(FIRST_VESPERS_PSALMS[w][2], "I Vespers NT canticle", "en/sample/antiphon-3"),
            ],
            short_reading: stubReading("Rom 11:33-36"),
            short_responsory: {
              text: "[Short responsory]",
              versicle: "[Short responsory versicle]",
              ...refs("en/sample/short-responsory"),
            },
            magnificat_antiphon: {
              ...stubAntiphon(`${label} I Vespers Magnificat antiphon`),
              ...refs("en/sample/gospel-antiphon"),
            },
            intercessions: stubIntercessions("First Vespers"),
            concluding_prayer: { text: `[${label} I Vespers concluding prayer]` },
          },
        }
      : {}),
    vespers: {
      hymns: {
        series_a: { ...stubHymn(`${label} Vespers hymn A`), ...refs("en/sample/hymn") },
        series_b: { ...stubHymn(`${label} Vespers hymn B`), ...refs("en/sample/hymn") },
      },
      psalm_assignments: [
        psalmSlot(vesp1, "Vespers psalm 1", "en/sample/antiphon-1"),
        psalmSlot(vesp2, "Vespers psalm 2", "en/sample/antiphon-2"),
        psalmSlot(ntCanticle, "Vespers NT canticle", "en/sample/antiphon-3"),
      ],
      short_reading: stubReading("1 Pet 1:3-5"),
      short_responsory: {
        text: "[Short responsory]",
        versicle: "[Short responsory versicle]",
        ...refs("en/sample/short-responsory"),
      },
      magnificat_antiphon: {
        ...stubAntiphon(`${label} Magnificat antiphon`),
        ...refs("en/sample/gospel-antiphon"),
      },
      intercessions: stubIntercessions("Vespers"),
      concluding_prayer: { text: `[${label} Vespers concluding prayer]` },
    },
    compline: {
      hymn: { ...stubHymn(`${label} Compline hymn`), ...refs("en/sample/hymn") },
      after_first_vespers: [
        psalmSlot("psalm_4", "Compline after I Vespers 1", "en/sample/antiphon-1"),
        psalmSlot("psalm_133", "Compline after I Vespers 2", "en/sample/antiphon-2"),
      ],
      after_second_vespers: [
        psalmSlot("psalm_90", "Compline after II Vespers", "en/sample/antiphon-1"),
      ],
      default_psalm_assignments: COMPLINE_FERIAL_PSALMS[dayName].map((id, i) =>
        psalmSlot(id, `Compline psalm ${i + 1}`, "en/sample/antiphon-2"),
      ),
      short_reading: stubReading("Rev 22:4-5"),
      nunc_dimittis_antiphon: {
        ...stubAntiphon(`${label} Nunc Dimittis antiphon`),
        ...refs("en/sample/gospel-antiphon"),
      },
      concluding_prayer: { text: `[${label} Compline concluding prayer]` },
    },
  };
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

async function writeYaml(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, yaml.dump(data, { lineWidth: 120, noRefs: true }), "utf-8");
}

async function generatePsalter() {
  const psalterDir = path.join(dataDir, "psalter");
  const psalmIds = new Set();
  const canticleIds = new Set();

  for (let week = 1; week <= 4; week++) {
    for (const day of WEEKDAYS) {
      const doc = buildPsalterDay(week, day);
      const fname = `week${week}_${day.toLowerCase()}.yaml`;
      await writeYaml(path.join(psalterDir, fname), doc);
      collectTextIds(doc, psalmIds, canticleIds);
    }
  }

  return { psalmIds: [...psalmIds], canticleIds: [...canticleIds] };
}

async function generateComplementary() {
  const gradual = [
    "psalm_120", "psalm_121", "psalm_122", "psalm_123", "psalm_124",
    "psalm_125", "psalm_126", "psalm_127", "psalm_128", "psalm_129",
    "psalm_130", "psalm_131", "psalm_132", "psalm_134",
  ];
  const dir = path.join(dataDir, "complementary_psalmody");
  const psalmIds = new Set(gradual);
  let idx = 0;
  for (const day of WEEKDAYS) {
    for (const hour of ["terce", "sext", "none"]) {
      const id = `complementary_${day.toLowerCase()}_${hour}`;
      const assignments = [0, 1, 2].map((i) => ({
        psalm_or_canticle_id: gradual[idx % gradual.length],
        antiphon: stubAntiphon(`${id} antiphon ${i + 1}`),
      }));
      idx += 3;
      await writeYaml(path.join(dir, `${id}.yaml`), { id, psalm_assignments: assignments });
    }
  }
  return psalmIds;
}

/**
 * Placeholder verses. Three of them, each with the `*` mediant, so the
 * assemblers get the same shape a real psalm has — several verses, each split
 * over two half-lines — without carrying anyone's translation.
 */
function stubVerses(id, count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    text: `[${id} — stub verse ${i + 1}, first half] *\n[${id} — stub verse ${i + 1}, second half]`,
  }));
}

function stubPsalm(id) {
  const num = parseInt(id.replace("psalm_118_", "").replace("psalm_", ""), 10) || 1;
  const is118 = id.includes("psalm_118_");
  return {
    id,
    number: is118 ? 118 : num,
    title: `[${id} title]`,
    christian_heading: `[${id} heading]`,
    omitted_verses: [],
    verses: stubVerses(id),
  };
}

function stubCanticle(id) {
  const type = id.startsWith("ot_") ? "OT" : "NT";
  return {
    id,
    type,
    source: `[${id} source]`,
    title: `[${id} title]`,
    verses: stubVerses(id),
  };
}

/**
 * Psalm and canticle ids referenced anywhere in the tree — the Commons and the
 * propers, not just the psalter tables. Written files are the source of truth
 * here, so a hand-edited proper pulls its psalms in on the next run.
 */
async function collectReferencedTextIds() {
  const psalms = new Set();
  const canticles = new Set();
  for (const dir of ["commons", "proper_of_saints", "proper_of_seasons", "psalter"]) {
    for (const file of await collectYamlFiles(path.join(dataDir, dir))) {
      collectTextIds(yaml.load(await fs.readFile(file, "utf-8")), psalms, canticles);
    }
  }
  psalms.delete(PSALM_UNASSIGNED);
  return { psalms, canticles };
}

/** Every .yaml under `dir`, recursively; empty when the directory is absent. */
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

/**
 * The sentinel an antiphon carries when its source does not record which psalm
 * goes with it. Empty by construction: it stands for a psalm, it is not one.
 */
async function writeUnassignedSentinel() {
  const fp = path.join(dataDir, "psalms", `${PSALM_UNASSIGNED}.yaml`);
  try {
    await fs.access(fp);
  } catch {
    await writeYaml(fp, {
      id: PSALM_UNASSIGNED,
      number: 0,
      title: "[unassigned psalmody]",
      christian_heading: "",
      omitted_verses: [],
      verses: [],
    });
  }
}

async function generatePsalmStubs(psalmIds) {
  const dir = path.join(dataDir, "psalms");
  for (const id of psalmIds) {
    const fp = path.join(dir, `${id}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      await writeYaml(fp, stubPsalm(id));
    }
  }
}

async function generateCanticleStubs(canticleIds) {
  const dir = path.join(dataDir, "canticles");
  const defaults = ["ot_dn3_glory", "nt_phil2"];
  for (const id of new Set([...canticleIds, ...defaults])) {
    const fp = path.join(dir, `${id}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      await writeYaml(fp, stubCanticle(id));
    }
  }
}

function stubOorReading(key) {
  const resp = {
    text: "[Responsory text]",
    verse: "[Responsory verse]",
    repeat_cue: "[Repeat]",
  };
  const biblical = {
    reference: `[${key} biblical ref]`,
    text: `[${key} biblical reading]`,
    responsory: resp,
  };
  const patristic = {
    author: "[Patristic author]",
    work: "[Work]",
    reference: `[${key} patristic ref]`,
    biographical_note: "[Note]",
    text: `[${key} patristic reading]`,
    responsory: resp,
  };
  return {
    key,
    office_of_readings: {
      biblical_reading: biblical,
      patristic_reading: patristic,
      biblical_reading_yr1: biblical,
      biblical_reading_yr2: biblical,
      patristic_reading_yr1: patristic,
      patristic_reading_yr2: patristic,
    },
  };
}

/** Collect seasonal keys by sampling civil dates across liturgical years. */
async function collectSeasonalKeys() {
  const { pathToFileURL } = await import("url");
  const distCalendar = path.join(repoRoot, "dist", "calendar", "liturgicalYear.js");
  try {
    await fs.access(distCalendar);
  } catch {
    console.error("Run `npm run build` before generate:data (needs dist/calendar).");
    process.exit(1);
  }
  const mod = await import(pathToFileURL(distCalendar).href);
  const keys = new Set();
  for (let y = 2020; y <= 2030; y++) {
    for (let m = 0; m < 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const date = new Date(Date.UTC(y, m, d));
        const key = mod.getSeasonalDayKey(date, "general");
        if (key) keys.add(key);
      }
    }
  }
  keys.add("easter_sunday");
  return [...keys];
}

async function generateSeasonalProper(keys) {
  const dir = path.join(dataDir, "proper_of_seasons");
  for (const key of keys) {
    const fp = path.join(dir, `${key}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      await writeYaml(fp, stubOorReading(key));
    }
  }
}

async function writePsalterReadme() {
  const readme = `# Psalter (four-week cycle)

Assignment tables follow the **Liturgy of the Hours** four-week psalter structure
(Grail psalm numbering). Psalm and canticle **IDs** match the official weekly
distribution; hymn, antiphon, and reading **text** are stubs until a licensed
translation is supplied.

Source for ID layout: ICEL *Christian Prayer* / *Liturgy of the Hours* four-week
psalter index (ferial psalmody, OT/NT canticles, Ps 119 daytime sections).

Regenerate files: \`npm run generate:data\`
`;
  await fs.writeFile(path.join(dataDir, "psalter", "README.md"), readme, "utf-8");
}

/** One proper_of_saints stub per sanctoral calendar entry (id only; schedule lives in calendars/). */
async function generateSaintStubs() {
  const ids = new Set();
  const generalPath = path.join(dataDir, "calendars", "general", "entries.yaml");
  try {
    const doc = yaml.load(await fs.readFile(generalPath, "utf-8"));
    for (const e of doc?.entries ?? []) ids.add(e.id);
  } catch { /* no general calendar */ }

  const stockholmPath = path.join(dataDir, "calendars", "local", "stockholm.yaml");
  try {
    const overlay = yaml.load(await fs.readFile(stockholmPath, "utf-8"));
    for (const e of overlay?.additions ?? []) ids.add(e.id);
  } catch { /* no particular overlay */ }

  const dir = path.join(dataDir, "proper_of_saints");
  let created = 0;
  for (const id of ids) {
    const fp = path.join(dir, `${id}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      await writeYaml(fp, { id });
      created += 1;
    }
  }
  return created;
}

const COMMON_TYPES = [
  "dedication_of_a_church", "bvm", "apostles", "martyrs",
  "pastors", "doctors", "virgins", "holy_men_women",
];

/** Complete stub CommonVariant — Commons are the fallback terminus (no absent fields). */
function stubCommonVariant(type) {
  const label = `[${type} variant 1]`;
  const resp = { text: "[Responsory text]", verse: "[Responsory verse]", repeat_cue: "[Repeat]" };
  const psalmody = (hour) => [
    { psalm_or_canticle_id: "psalm_112", antiphon: stubAntiphon(`${type} ${hour} antiphon 1`) },
    { psalm_or_canticle_id: "psalm_116", antiphon: stubAntiphon(`${type} ${hour} antiphon 2`) },
    { psalm_or_canticle_id: "nt_phil2", antiphon: stubAntiphon(`${type} ${hour} antiphon 3`) },
  ];
  const vespersSlot = (hour) => ({
    hymn: stubHymn(`${type} ${hour} hymn`),
    psalm_assignments: psalmody(hour),
    short_reading: stubReading(`${type} ${hour} reading`),
    short_responsory: { text: "[Short responsory]", versicle: "[Short responsory versicle]" },
    magnificat_antiphon: stubAntiphon(`${type} ${hour} Magnificat antiphon`),
    intercessions: stubIntercessions(hour),
    concluding_prayer: { text: `[${type} concluding prayer]` },
  });
  const daytimeSlot = (hour) => ({
    hymn: stubHymn(`${type} ${hour} hymn`),
    psalm_assignments: psalmody(hour),
    antiphons: [1, 2, 3].map((i) => stubAntiphon(`${type} ${hour} gradual antiphon ${i}`)),
    short_reading: stubReading(`${type} ${hour} reading`),
    versicle: { verse: `[${type} ${hour} versicle]`, response: `[${type} ${hour} response]` },
    concluding_prayer: { text: `[${type} concluding prayer]` },
  });
  return {
    label,
    invitatory_antiphon: stubAntiphon(`${type} invitatory`),
    office_of_readings: {
      hymns: { night: stubHymn(`${type} OoR night hymn`), day: stubHymn(`${type} OoR day hymn`) },
      psalm_assignments: psalmody("OoR"),
      versicle: { verse: `[${type} OoR versicle]`, response: `[${type} OoR response]` },
      biblical_reading: { reference: `[${type} biblical ref]`, text: `[${type} biblical reading]`, responsory: resp },
      patristic_reading: {
        author: "[Author]", work: "[Work]", reference: `[${type} patristic ref]`,
        biographical_note: "[Note]", text: `[${type} patristic reading]`, responsory: resp,
      },
      hagiographical_reading: {
        author: "[Author]", work: "[Work]", reference: `[${type} hagiographical ref]`,
        biographical_note: "[Note]", text: `[${type} hagiographical reading]`, responsory: resp,
      },
    },
    first_vespers: vespersSlot("First Vespers"),
    lauds: {
      hymn: stubHymn(`${type} Lauds hymn`),
      psalm_assignments: psalmody("Lauds"),
      short_reading: stubReading(`${type} Lauds reading`),
      short_responsory: { text: "[Short responsory]", versicle: "[Short responsory versicle]" },
      benedictus_antiphon: stubAntiphon(`${type} Benedictus antiphon`),
      intercessions: stubIntercessions("Lauds"),
      concluding_prayer: { text: `[${type} concluding prayer]` },
    },
    terce: daytimeSlot("Terce"),
    sext: daytimeSlot("Sext"),
    none: daytimeSlot("None"),
    vespers: vespersSlot("Vespers"),
  };
}

async function generateCommonsStubs() {
  const dir = path.join(dataDir, "commons");
  let created = 0;
  for (const type of COMMON_TYPES) {
    const fp = path.join(dir, `${type}.yaml`);
    try {
      await fs.access(fp);
    } catch {
      await writeYaml(fp, { type, variants: [stubCommonVariant(type)] });
      created += 1;
    }
  }
  return created;
}

/** Seed fixed_texts.yaml and calendars/ for a new locale from the en bundle. */
async function seedLocaleBaseline() {
  if (locale === "en") return;
  const enDir = path.join(repoRoot, "data", "en");
  const fixedTarget = path.join(dataDir, "fixed_texts.yaml");
  try {
    await fs.access(fixedTarget);
  } catch {
    await fs.copyFile(path.join(enDir, "fixed_texts.yaml"), fixedTarget);
    console.log(`seeded ${locale}/fixed_texts.yaml from en (translate in place)`);
  }
  const calendarsTarget = path.join(dataDir, "calendars");
  try {
    await fs.access(calendarsTarget);
  } catch {
    await fs.cp(path.join(enDir, "calendars"), calendarsTarget, { recursive: true });
    console.log(`seeded ${locale}/calendars/ from en`);
  }
}

async function main() {
  await fs.mkdir(dataDir, { recursive: true });
  const { psalmIds, canticleIds } = await generatePsalter();
  const compIds = await generateComplementary();
  const saints = await generateSaintStubs();
  const commons = await generateCommonsStubs();

  // Every psalm and canticle the generated tree points at, from wherever it
  // points: the Commons name the Laudate psalms that First Vespers of a
  // solemnity falls back to, and nothing else in here would mention them.
  const { psalms: refPsalms, canticles: refCanticles } = await collectReferencedTextIds();
  const allPsalms = new Set([...psalmIds, ...compIds, ...refPsalms]);
  await generatePsalmStubs(allPsalms);
  await writeUnassignedSentinel();
  await generateCanticleStubs(new Set([...canticleIds, ...refCanticles]));
  const keys = await collectSeasonalKeys();
  await generateSeasonalProper(keys);
  await writePsalterReadme();
  await seedLocaleBaseline();
  console.log(`Generated [${locale}] psalter (28), psalms (${allPsalms.size}), canticles, complementary (21), seasonal (${keys.length}), saints (+${saints}), commons (+${commons})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
