/**
 * Universal and particular sanctoral calendars, merged.
 *
 * Reading them off disk lives in `./sanctoralRegistryNode.js`; this module
 * stays free of Node APIs so it can run on a Cloudflare Worker.  The merge
 * helpers below are exported for that loader's use.
 */

import { utcDate } from "./computus.js";
import { applyTransferRule } from "./transferRules.js";
import type { RegistryBundle } from "../types/bundle.js";
import type {
  CalendarSaint,
  ParticularCalendarOverlay,
  SanctoralCalendarEntry,
} from "../types/sanctoralCalendar.js";
import type {
  SeasonalObservanceOverride,
  SeasonalObservancePolicy,
} from "../types/seasonalObservance.js";
import {
  ASCENSION_OBSERVANCE_VALUES,
  CORPUS_CHRISTI_OBSERVANCE_VALUES,
  EPIPHANY_OBSERVANCE_VALUES,
} from "../types/seasonalObservance.js";

export function mergeEntries(
  base: SanctoralCalendarEntry[],
  overlay?: ParticularCalendarOverlay,
): SanctoralCalendarEntry[] {
  const map = new Map<string, SanctoralCalendarEntry>();
  for (const entry of base) {
    map.set(entry.id, { ...entry });
  }
  if (overlay?.overrides) {
    for (const patch of overlay.overrides) {
      const existing = map.get(patch.id);
      if (!existing) {
        throw new Error(
          `Calendar override references unknown saint id: ${patch.id}`,
        );
      }
      map.set(patch.id, { ...existing, ...patch });
    }
  }
  if (overlay?.additions) {
    for (const entry of overlay.additions) {
      if (map.has(entry.id)) {
        throw new Error(
          `Calendar addition duplicates existing saint id: ${entry.id}`,
        );
      }
      map.set(entry.id, { ...entry });
    }
  }
  if (overlay?.suppressions) {
    for (const id of overlay.suppressions) {
      map.delete(id);
    }
  }
  return [...map.values()];
}

function assertEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
  calendarId: string,
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(
      `Invalid seasonal_observance.${field} for calendar "${calendarId}": ${String(value)}`,
    );
  }
  return value as T;
}

export function mergeSeasonalObservance(
  base: SeasonalObservancePolicy,
  overlay?: SeasonalObservanceOverride,
  calendarId = "general",
): SeasonalObservancePolicy {
  if (!overlay) return { ...base };
  const merged = { ...base };
  if (overlay.epiphany !== undefined) {
    merged.epiphany = assertEnumValue(
      overlay.epiphany,
      EPIPHANY_OBSERVANCE_VALUES,
      "epiphany",
      calendarId,
    );
  }
  if (overlay.corpusChristi !== undefined) {
    merged.corpusChristi = assertEnumValue(
      overlay.corpusChristi,
      CORPUS_CHRISTI_OBSERVANCE_VALUES,
      "corpus_christi",
      calendarId,
    );
  }
  if (overlay.ascension !== undefined) {
    merged.ascension = assertEnumValue(
      overlay.ascension,
      ASCENSION_OBSERVANCE_VALUES,
      "ascension",
      calendarId,
    );
  }
  return merged;
}

export function nominalDateFromEntry(
  entry: SanctoralCalendarEntry,
  year: number,
): Date {
  const pos = entry.calendarPosition;
  if (pos.type === "fixed") {
    return utcDate(year, pos.month, pos.day);
  }
  throw new Error(
    `Moveable sanctoral entries are not yet supported (saint id: ${entry.id})`,
  );
}

export function compileToCalendarSaint(entry: SanctoralCalendarEntry): CalendarSaint {
  return {
    saintId: entry.id,
    ...(entry.name !== undefined ? { name: entry.name } : {}),
    rank: entry.rank,
    applicableCommons: entry.applicableCommons,
    ...(entry.observanceOf !== undefined ? { observanceOf: entry.observanceOf } : {}),
    nominalDate: (year) => nominalDateFromEntry(entry, year),
    celebrationDate: (year) => {
      const nominal = nominalDateFromEntry(entry, year);
      if (entry.transferRule) {
        return applyTransferRule(entry.transferRule, nominal, year);
      }
      return nominal;
    },
  };
}

export class SanctoralCalendarRegistry {
  private readonly mergedEntries = new Map<string, SanctoralCalendarEntry[]>();
  private readonly saintsByCalendar = new Map<string, CalendarSaint[]>();
  private readonly seasonalObservanceByCalendar = new Map<
    string,
    SeasonalObservancePolicy
  >();

  private constructor(
    merged: Map<string, SanctoralCalendarEntry[]>,
    seasonalObservance: Map<string, SeasonalObservancePolicy>,
  ) {
    this.mergedEntries = merged;
    this.seasonalObservanceByCalendar = seasonalObservance;
    for (const [calendarId, entries] of merged) {
      this.saintsByCalendar.set(
        calendarId,
        entries.map(compileToCalendarSaint),
      );
    }
  }

  /**
   * The only way to construct a registry.  `loadSanctoralRegistry` in
   * ./sanctoralRegistryNode.js reads the calendar YAML and comes through here
   * too, so Node and Worker hosts share one assembly path.
   */
  static fromBundle(b: RegistryBundle): SanctoralCalendarRegistry {
    return new SanctoralCalendarRegistry(
      new Map(b.merged),
      new Map(b.seasonalObservance),
    );
  }

  /** The inverse of `fromBundle`, for the publish step. */
  toBundle(): RegistryBundle {
    return {
      v: 1,
      merged: [...this.mergedEntries],
      seasonalObservance: [...this.seasonalObservanceByCalendar],
    };
  }

  hasCalendar(calendarId: string): boolean {
    return this.mergedEntries.has(calendarId);
  }

  getMergedEntries(calendarId: string): SanctoralCalendarEntry[] {
    const entries = this.mergedEntries.get(calendarId);
    if (!entries) {
      throw new Error(`Unknown sanctoral calendar id: ${calendarId}`);
    }
    return entries;
  }

  getSaints(calendarId: string): CalendarSaint[] {
    const saints = this.saintsByCalendar.get(calendarId);
    if (!saints) {
      throw new Error(`Unknown sanctoral calendar id: ${calendarId}`);
    }
    return saints;
  }

  getSeasonalObservance(calendarId: string): SeasonalObservancePolicy {
    const policy = this.seasonalObservanceByCalendar.get(calendarId);
    if (!policy) {
      throw new Error(`Unknown sanctoral calendar id: ${calendarId}`);
    }
    return policy;
  }
}
