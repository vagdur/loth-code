/**
 * DataRepository — loads all data from YAML files and exposes typed accessors.
 *
 * Assemblers call repository methods to resolve SlotSource references into
 * actual text objects.  The repository is loaded once at startup.
 */

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import type {
  Antiphon, AssemblerLabels, BiblicalReading, Canticle, ConcludingPrayer,
  FixedTexts, GospelCanticleFixed, GospelCanticleKind, HagiographicalReading,
  Hymn, HymnSet, Intercessions, OorHymnSet, PatristicReading, Psalm,
  PsalmAssignment, ShortReading, ShortResponsory, TeDeumFixed, Versicle,
} from "../types/texts.js";
import type { PsalterDay, PsalterWeek, ComplementaryPsalmGroup, Weekday } from "../types/psalter.js";
import type { Common, CommonType, SeasonalProperDay, SaintEntry } from "../types/proper.js";
import type { SlotSourceDirect } from "../types/hours.js";

// ---------------------------------------------------------------------------
// YAML loading helpers
// ---------------------------------------------------------------------------

async function loadYaml<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return camelCaseKeys(yaml.load(content)) as T;
}

async function loadYamlDir<T>(dirPath: string): Promise<T[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dirPath);
  } catch {
    return [];
  }
  const yamlFiles = entries.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  return Promise.all(yamlFiles.map((f) => loadYaml<T>(path.join(dirPath, f))));
}

/** Recursively convert all object keys from snake_case to camelCase. */
function camelCaseKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(camelCaseKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        camelCaseKeys(v),
      ]),
    );
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class DataRepository {
  private psalms:       Map<string, Psalm>              = new Map();
  private canticles:    Map<string, Canticle>           = new Map();
  private psalterDays:  Map<string, PsalterDay>         = new Map();
  private compGroups:   ComplementaryPsalmGroup[]       = [];
  private seasonal:     Map<string, SeasonalProperDay>  = new Map();
  private saints:       Map<string, SaintEntry>         = new Map();
  private commons:      Map<CommonType, Common>         = new Map();
  private fixedTexts:   FixedTexts | null               = null;
  readonly locale: string;

  private constructor(locale: string) {
    this.locale = locale;
  }

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  static async load(dataRoot: string, locale = "en"): Promise<DataRepository> {
    const localeDir = path.join(dataRoot, locale);
    const repo = new DataRepository(locale);

    const [psalms, canticles, psalterDays, compGroups, seasonalDays, saintEntries, commonEntries, fixed] =
      await Promise.all([
        loadYamlDir<Psalm>(path.join(localeDir, "psalms")),
        loadYamlDir<Canticle>(path.join(localeDir, "canticles")),
        loadYamlDir<PsalterDay>(path.join(localeDir, "psalter")),
        loadYamlDir<ComplementaryPsalmGroup>(path.join(localeDir, "complementary_psalmody")),
        loadYamlDir<SeasonalProperDay>(path.join(localeDir, "proper_of_seasons")),
        loadYamlDir<SaintEntry>(path.join(localeDir, "proper_of_saints")),
        loadYamlDir<Common>(path.join(localeDir, "commons")),
        loadYaml<FixedTexts>(path.join(localeDir, "fixed_texts.yaml")).catch(() => null),
      ]);

    for (const p of psalms)       repo.psalms.set(p.id, p);
    for (const c of canticles)    repo.canticles.set(c.id, c);
    for (const d of psalterDays)  repo.psalterDays.set(psalterKey(d.week, d.day), d);
    repo.compGroups = compGroups;
    for (const s of seasonalDays) repo.seasonal.set(s.key, s);
    for (const s of saintEntries) repo.saints.set(s.id, s);
    for (const c of commonEntries) repo.commons.set(c.type, c);
    repo.fixedTexts = fixed;

    return repo;
  }

  // -------------------------------------------------------------------------
  // Resolution entry point
  // -------------------------------------------------------------------------

  /**
   * Resolve a direct SlotSource to a value.  Returns undefined if the
   * referenced field is absent (the caller should try the next source in
   * a FallbackChain).
   */
  resolve(source: SlotSourceDirect): unknown {
    switch (source.kind) {
      case "psalm":    return this.psalms.get(source.id);
      case "canticle": return this.canticles.get(source.id);
      case "fixed":    return this.fixedTexts ? getPath(this.fixedTexts, source.field) : undefined;
      case "psalter": {
        const day = this.psalterDays.get(psalterKey(source.week, source.day));
        return day ? getPath(day, source.field) : undefined;
      }
      case "seasonal": {
        const day = this.seasonal.get(source.key);
        return day ? getPath(day, source.field) : undefined;
      }
      case "saint": {
        const saint = this.saints.get(source.id);
        return saint ? getPath(saint, source.field) : undefined;
      }
      case "common": {
        const common = this.commons.get(source.type);
        const variant = common?.variants[source.variant];
        return variant ? getPath(variant, source.field) : undefined;
      }
      case "complementary": {
        const group = this.getComplementaryGroup(source.groupId);
        return group?.psalmAssignments[source.index];
      }
    }
  }

  // -------------------------------------------------------------------------
  // Typed accessors (used by assemblers)
  // -------------------------------------------------------------------------

  getPsalm(id: string): Psalm | undefined           { return this.psalms.get(id); }
  getCanticle(id: string): Canticle | undefined     { return this.canticles.get(id); }
  getComplementaryGroups(): ComplementaryPsalmGroup[] { return this.compGroups; }
  getComplementaryGroup(id: string): ComplementaryPsalmGroup | undefined {
    return this.compGroups.find((g) => g.id === id);
  }

  getFixedTexts(): FixedTexts | undefined {
    return this.fixedTexts ?? undefined;
  }

  getAssemblerLabels(): AssemblerLabels {
    const labels = this.fixedTexts?.labels;
    if (!labels) {
      throw new Error(
        `Assembler labels missing for locale "${this.locale}" (fixed_texts.yaml)`,
      );
    }
    return labels;
  }

  getGospelCanticle(kind: GospelCanticleKind): GospelCanticleFixed | undefined {
    const fixed = this.fixedTexts;
    if (!fixed) return undefined;
    return fixed[kind];
  }

  getTeDeum(): TeDeumFixed | undefined {
    return this.fixedTexts?.teDeum;
  }

  resolveHymn(source: SlotSourceDirect): Hymn | undefined {
    return this.resolve(source) as Hymn | undefined;
  }
  resolveAntiphon(source: SlotSourceDirect): Antiphon | undefined {
    return this.resolve(source) as Antiphon | undefined;
  }
  resolvePsalmAssignment(source: SlotSourceDirect): PsalmAssignment | undefined {
    return this.resolve(source) as PsalmAssignment | undefined;
  }
  resolveShortReading(source: SlotSourceDirect): ShortReading | undefined {
    return this.resolve(source) as ShortReading | undefined;
  }
  resolveShortResponsory(source: SlotSourceDirect): ShortResponsory | undefined {
    return this.resolve(source) as ShortResponsory | undefined;
  }
  resolveVersicle(source: SlotSourceDirect): Versicle | undefined {
    return this.resolve(source) as Versicle | undefined;
  }
  resolveBiblicalReading(source: SlotSourceDirect): BiblicalReading | undefined {
    return this.resolve(source) as BiblicalReading | undefined;
  }
  resolvePatristicReading(source: SlotSourceDirect): PatristicReading | undefined {
    return this.resolve(source) as PatristicReading | undefined;
  }
  resolveHagiographicalReading(source: SlotSourceDirect): HagiographicalReading | undefined {
    return this.resolve(source) as HagiographicalReading | undefined;
  }
  resolveIntercessions(source: SlotSourceDirect): Intercessions | undefined {
    return this.resolve(source) as Intercessions | undefined;
  }
  resolveConcludingPrayer(source: SlotSourceDirect): ConcludingPrayer | undefined {
    return this.resolve(source) as ConcludingPrayer | undefined;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function psalterKey(week: PsalterWeek, day: Weekday): string {
  return `week${week}_${day.toLowerCase()}`;
}

/**
 * Navigate a dot-path through an object, handling array indices.
 *
 * Supports paths like "lauds.psalmAssignments[0].antiphon.text".
 * Each dot-separated segment may optionally carry a trailing "[N]" index.
 */
function getPath(obj: unknown, dotPath: string): unknown {
  // Split on dots first, then parse each segment for an optional [N] suffix.
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    const arrayMatch = /^([^\[]+)\[(\d+)\]$/.exec(part);
    if (arrayMatch) {
      const key = arrayMatch[1] as string;
      const index = parseInt(arrayMatch[2] as string, 10);
      const arr = (current as Record<string, unknown>)[key];
      if (!Array.isArray(arr)) return undefined;
      current = arr[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}
