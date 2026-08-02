/**
 * Serialized forms of the two loaded-data holders, for hosts that cannot read
 * the YAML tree themselves.
 *
 * `DataRepository` and `SanctoralCalendarRegistry` are normally built by the
 * Node loaders in `src/data/repositoryNode.ts` and
 * `src/calendar/sanctoralRegistryNode.ts`, which walk `data/<locale>/`. A
 * Cloudflare Worker has no filesystem, so the loaders instead run at publish
 * time and emit these bundles; the Worker fetches one and calls `fromBundle`.
 *
 * Both are plain JSON: `Map`s become entry arrays, and the camelCasing that
 * `loadYaml` does on the way in has already been applied. Parsing a bundle
 * therefore costs about half what loading the YAML does, because the key
 * rewrite does not have to run again.
 *
 * These types live under `types/` rather than next to either class because
 * `src/calendar/` otherwise has no dependency on `src/data/`, and a shared
 * bundle module in `src/data/` would create one.
 */

import type { Canticle, FixedTexts, Psalm } from "./texts.js";
import type { ComplementaryPsalmGroup, PsalterDay } from "./psalter.js";
import type { Common, CommonType, SaintEntry, SeasonalProperDay } from "./proper.js";
import type { StoredMelody } from "./melody.js";
import type { SanctoralCalendarEntry } from "./sanctoralCalendar.js";
import type { SeasonalObservancePolicy } from "./seasonalObservance.js";

/** Everything `DataRepository` holds, as JSON. Mirrors its private fields. */
export interface RepoBundle {
  v: 1;
  locale: string;
  psalms: [string, Psalm][];
  canticles: [string, Canticle][];
  psalterDays: [string, PsalterDay][];
  compGroups: ComplementaryPsalmGroup[];
  seasonal: [string, SeasonalProperDay][];
  saints: [string, SaintEntry][];
  commons: [CommonType, Common][];
  fixedTexts: FixedTexts | null;
  melodies: [string, StoredMelody][];
  melodyAliases: [string, string][];
}

/**
 * Everything `SanctoralCalendarRegistry` needs, as JSON.
 *
 * Only the two constructor inputs are carried. The third field,
 * `saintsByCalendar`, is rederived by `compileToCalendarSaint`, whose
 * `nominalDate`/`celebrationDate` are closures — not serializable, and cheap
 * enough to rebuild that storing them would be a pessimization.
 */
export interface RegistryBundle {
  v: 1;
  merged: [string, SanctoralCalendarEntry[]][];
  seasonalObservance: [string, SeasonalObservancePolicy][];
}
