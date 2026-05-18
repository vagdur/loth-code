/**
 * Saints on the liturgical calendar, with transfer rules for solemnities.
 *
 * Calendar data is loaded from data/calendars/ via SanctoralCalendarRegistry;
 * call initSanctoralRegistry() before resolveDay or getSaintsOnDate.
 */

import type { CalendarSaint } from "../types/sanctoralCalendar.js";
import type { SanctoralCalendarRegistry } from "./sanctoralRegistry.js";

export type { CalendarSaint };

let registry: SanctoralCalendarRegistry | null = null;

export function initSanctoralRegistry(r: SanctoralCalendarRegistry): void {
  registry = r;
}

export function getSanctoralRegistry(): SanctoralCalendarRegistry {
  if (!registry) {
    throw new Error(
      "Sanctoral calendar not loaded; call initSanctoralRegistry() first",
    );
  }
  return registry;
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
