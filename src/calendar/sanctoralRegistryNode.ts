/**
 * Reading the sanctoral calendar YAML into a SanctoralCalendarRegistry.
 * Node only.
 *
 * The filesystem half of the old `SanctoralCalendarRegistry.load`, split out
 * so that `./sanctoralRegistry.js` stays importable from a Cloudflare Worker.
 * Reachable from the package's `./node` entry point, never from `.`.
 */

import path from "path";

import {
  SanctoralCalendarRegistry,
  mergeEntries,
  mergeSeasonalObservance,
} from "./sanctoralRegistry.js";
import { loadYaml } from "../data/repositoryNode.js";
import type { RegistryBundle } from "../types/bundle.js";
import type {
  ParticularCalendarOverlay,
  SanctoralCalendarEntriesFile,
  SanctoralCalendarEntry,
  SanctoralCalendarIndex,
} from "../types/sanctoralCalendar.js";
import type { SeasonalObservancePolicy } from "../types/seasonalObservance.js";
import { DEFAULT_SEASONAL_OBSERVANCE } from "../types/seasonalObservance.js";

/** Read `<dataRoot>/<locale>/calendars/` into a registry. */
export async function loadSanctoralRegistry(
  dataRoot: string,
  locale = "en",
): Promise<SanctoralCalendarRegistry> {
  return SanctoralCalendarRegistry.fromBundle(
    await readRegistryBundle(dataRoot, locale),
  );
}

/**
 * Read `<dataRoot>/<locale>/calendars/` into a serializable bundle.
 *
 * As with the data repository, the loader is defined in terms of this, so the
 * published bundle is by construction what the Node path produces.
 */
export async function readRegistryBundle(
  dataRoot: string,
  locale = "en",
): Promise<RegistryBundle> {
  const calendarsDir = path.join(dataRoot, locale, "calendars");
  const index = await loadYaml<SanctoralCalendarIndex>(
    path.join(calendarsDir, "index.yaml"),
  );

  const generalMeta = index.calendars.general;
  if (!generalMeta?.entries) {
    throw new Error("Sanctoral calendar index missing general.entries");
  }

  const generalFile = await loadYaml<SanctoralCalendarEntriesFile>(
    path.join(calendarsDir, generalMeta.entries),
  );

  const merged = new Map<string, SanctoralCalendarEntry[]>();
  merged.set("general", generalFile.entries);

  const seasonalObservance = new Map<string, SeasonalObservancePolicy>();
  seasonalObservance.set("general", { ...DEFAULT_SEASONAL_OBSERVANCE });

  for (const [calendarId, meta] of Object.entries(index.calendars)) {
    if (calendarId === "general") continue;
    if (meta.layer !== "particular" || !meta.overlay) continue;

    const baseId = meta.extends ?? "general";
    const base = merged.get(baseId);
    if (!base) {
      throw new Error(
        `Particular calendar "${calendarId}" extends unknown calendar "${baseId}"`,
      );
    }

    const overlay = await loadYaml<ParticularCalendarOverlay>(
      path.join(calendarsDir, meta.overlay),
    );
    merged.set(calendarId, mergeEntries(base, overlay));

    const basePolicy =
      seasonalObservance.get(baseId) ?? DEFAULT_SEASONAL_OBSERVANCE;
    seasonalObservance.set(
      calendarId,
      mergeSeasonalObservance(basePolicy, overlay.seasonalObservance, calendarId),
    );
  }

  return {
    v: 1,
    merged: [...merged],
    seasonalObservance: [...seasonalObservance],
  };
}
