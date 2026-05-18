/**
 * Loads universal and particular sanctoral calendars from YAML and merges them.
 */

import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import { utcDate } from "./computus.js";
import { applyTransferRule } from "./transferRules.js";
import type {
  CalendarSaint,
  ParticularCalendarOverlay,
  SanctoralCalendarEntriesFile,
  SanctoralCalendarEntry,
  SanctoralCalendarIndex,
} from "../types/sanctoralCalendar.js";
import type {
  SeasonalObservanceOverride,
  SeasonalObservancePolicy,
} from "../types/seasonalObservance.js";
import {
  ASCENSION_OBSERVANCE_VALUES,
  CORPUS_CHRISTI_OBSERVANCE_VALUES,
  DEFAULT_SEASONAL_OBSERVANCE,
  EPIPHANY_OBSERVANCE_VALUES,
} from "../types/seasonalObservance.js";

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

async function loadYaml<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return camelCaseKeys(yaml.load(content)) as T;
}

function mergeEntries(
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

function mergeSeasonalObservance(
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

  static async load(dataDir: string): Promise<SanctoralCalendarRegistry> {
    const calendarsDir = path.join(dataDir, "calendars");
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
    const generalEntries = generalFile.entries;

    const merged = new Map<string, SanctoralCalendarEntry[]>();
    merged.set("general", generalEntries);

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

    return new SanctoralCalendarRegistry(merged, seasonalObservance);
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
