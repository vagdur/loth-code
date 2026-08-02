/**
 * Reading the YAML data tree into a DataRepository.  Node only.
 *
 * This is the half of the old `DataRepository.load` that touches the
 * filesystem.  It lives apart from the class so that hosts without a
 * filesystem — a Cloudflare Worker — can import `./repository.js` without
 * dragging `fs`, `path` and `js-yaml` in behind it.
 *
 * Reachable from the package's `./node` entry point, never from `.`.
 */

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { DataRepository, psalterKey } from "./repository.js";
import type { RepoBundle } from "../types/bundle.js";
import type { Canticle, FixedTexts, Psalm } from "../types/texts.js";
import type { ComplementaryPsalmGroup, PsalterDay } from "../types/psalter.js";
import type { Common, SaintEntry, SeasonalProperDay } from "../types/proper.js";
import type { StoredMelody } from "../types/melody.js";

// ---------------------------------------------------------------------------
// YAML loading helpers
// ---------------------------------------------------------------------------

export async function loadYaml<T>(filePath: string): Promise<T> {
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
export function camelCaseKeys(obj: unknown): unknown {
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
// Loading
// ---------------------------------------------------------------------------

/** Read `<dataRoot>/<locale>/` into a repository. */
export async function loadRepository(
  dataRoot: string,
  locale = "en",
): Promise<DataRepository> {
  return DataRepository.fromBundle(await readRepoBundle(dataRoot, locale));
}

/**
 * Read `<dataRoot>/<locale>/` into a serializable bundle, for publishing to a
 * host that cannot read the tree itself.
 *
 * `loadRepository` is defined in terms of this rather than the other way
 * round, so what gets published is by construction what the Node path loads.
 */
export async function readRepoBundle(
  dataRoot: string,
  locale = "en",
): Promise<RepoBundle> {
  const localeDir = path.join(dataRoot, locale);

  const [psalms, canticles, psalterDays, compGroups, seasonalDays, saintEntries, commonEntries, fixed, melodyBundles] =
    await Promise.all([
      loadYamlDir<Psalm>(path.join(localeDir, "psalms")),
      loadYamlDir<Canticle>(path.join(localeDir, "canticles")),
      loadYamlDir<PsalterDay>(path.join(localeDir, "psalter")),
      loadYamlDir<ComplementaryPsalmGroup>(path.join(localeDir, "complementary_psalmody")),
      loadYamlDir<SeasonalProperDay>(path.join(localeDir, "proper_of_seasons")),
      loadYamlDir<SaintEntry>(path.join(localeDir, "proper_of_saints")),
      loadYamlDir<Common>(path.join(localeDir, "commons")),
      loadYaml<FixedTexts>(path.join(localeDir, "fixed_texts.yaml")).catch(() => null),
      loadYamlDir<StoredMelody[]>(path.join(localeDir, "melodies")),
    ]);

  // Later entries win on duplicate ids, matching Map.set insertion order.
  const melodies: [string, StoredMelody][] = [];
  const melodyAliases: [string, string][] = [];
  for (const bundle of melodyBundles) {
    for (const m of bundle ?? []) {
      melodies.push([m.id, m]);
      for (const alias of m.aliases ?? []) melodyAliases.push([alias, m.id]);
    }
  }

  return {
    v: 1,
    locale,
    psalms:      psalms.map((p) => [p.id, p]),
    canticles:   canticles.map((c) => [c.id, c]),
    psalterDays: psalterDays.map((d) => [psalterKey(d.week, d.day), d]),
    compGroups,
    seasonal:    seasonalDays.map((s) => [s.key, s]),
    saints:      saintEntries.map((s) => [s.id, s]),
    commons:     commonEntries.map((c) => [c.type, c]),
    fixedTexts:  fixed,
    melodies,
    melodyAliases,
  };
}
