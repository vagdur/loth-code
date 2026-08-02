/**
 * Saints on the liturgical calendar, with transfer rules for solemnities.
 *
 * Calendar data is loaded from data/calendars/ via SanctoralCalendarRegistry;
 * call initSanctoralRegistry() before resolveDay or getSaintsOnDate.
 */

import type { CalendarSaint } from "../types/sanctoralCalendar.js";
import type { SeasonalObservancePolicy } from "../types/seasonalObservance.js";
import { DEFAULT_SEASONAL_OBSERVANCE } from "../types/seasonalObservance.js";
import type { SanctoralCalendarRegistry } from "./sanctoralRegistry.js";

export type { CalendarSaint };

let registry: SanctoralCalendarRegistry | null = null;

export function initSanctoralRegistry(r: SanctoralCalendarRegistry): void {
  registry = r;
}

/**
 * Run `fn` with `r` installed as the ambient registry, then restore whatever
 * was there before.
 *
 * A long-lived host that serves more than one locale cannot use
 * `initSanctoralRegistry`: registries are per-locale, so a second request
 * setting the global would change the calendar out from under a render already
 * in progress.  Every path from `resolveDay` through the assemblers is
 * synchronous, so scoping the assignment around a synchronous callback is
 * enough to make that impossible — hence the guard below, which turns the
 * "must be synchronous" precondition into an error rather than a comment.
 *
 * Save/restore rather than clear, so nesting two locales in one request works.
 */
export function withSanctoralRegistry<T>(
  r: SanctoralCalendarRegistry,
  fn: () => T,
): T {
  const prev = registry;
  registry = r;
  try {
    const out = fn();
    if (out instanceof Promise) {
      throw new Error(
        "withSanctoralRegistry callback must be synchronous; the registry is " +
          "restored before the promise settles",
      );
    }
    return out;
  } finally {
    registry = prev;
  }
}

export function getSanctoralRegistry(): SanctoralCalendarRegistry {
  if (!registry) {
    throw new Error(
      "Sanctoral calendar not loaded; call initSanctoralRegistry() first",
    );
  }
  return registry;
}

/** Seasonal solemnity dates for a calendar (defaults when registry not loaded). */
export function getSeasonalObservance(
  calendarId = "general",
): SeasonalObservancePolicy {
  if (registry) {
    return registry.getSeasonalObservance(calendarId);
  }
  if (calendarId === "general") {
    return DEFAULT_SEASONAL_OBSERVANCE;
  }
  throw new Error(
    "Sanctoral calendar not loaded; call initSanctoralRegistry() first",
  );
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Returns saints whose ACTUAL celebration date is `date` — i.e. saints
 * either nominally on `date` (and not transferred away) or transferred
 * onto `date` from another nominal date.
 *
 * The previous civil year is also checked in case a saint nominally in
 * late December were transferred forward across the year boundary.
 */
export function getSaintsOnDate(date: Date, calendarId = "general"): CalendarSaint[] {
  const saints = getSanctoralRegistry().getSaints(calendarId);
  const year = date.getUTCFullYear();
  const results: CalendarSaint[] = [];
  for (const saint of saints) {
    if (
      sameUtcDay(saint.celebrationDate(year), date) ||
      sameUtcDay(saint.celebrationDate(year - 1), date)
    ) {
      results.push(saint);
    }
  }
  return results;
}
