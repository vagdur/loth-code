/**
 * Saints in the General Roman Calendar, with GNLY n. 60 transfer rules
 * for solemnities impeded by higher-ranking days.
 *
 * Each saint computes its own civil date for a given year:
 *   - nominalDate(year):     the date inscribed in the calendar
 *   - celebrationDate(year): the date ACTUALLY celebrated, after transfer
 *
 * For non-transferable observances the two are identical.  Per GILH 222
 * only solemnities are transferable, so transfer logic only applies to
 * entries of rank "solemnity".
 */

import { addDays, easterSunday, palmSunday, utcDate } from "./computus.js";
import type { CommonType } from "../types/proper.js";

export interface CalendarSaint {
  saintId: string;
  rank: "solemnity" | "feast" | "obligatory_memoria" | "optional_memoria";
  /** Ordered fallback commons when proper texts are absent. */
  applicableCommons: CommonType[];
  /** Date inscribed in the calendar, ignoring any transfer. */
  nominalDate(year: number): Date;
  /** Actual date of celebration in `year` after applying transfer rules. */
  celebrationDate(year: number): Date;
}

/**
 * Annunciation of the Lord — 25 March, solemnity.
 *
 * Transfer rules (GNLY 60, applied here):
 *   1. If 25 March falls within Holy Week or the Easter Octave (i.e.
 *      between Palm Sunday and the Second Sunday of Easter inclusive),
 *      it is transferred to the Monday after the Second Sunday of Easter.
 *   2. If 25 March falls on a Sunday of Lent (other than Palm Sunday),
 *      it is transferred to the following Monday.
 *   3. Otherwise it is kept on 25 March.
 */
export const ANNUNCIATION: CalendarSaint = {
  saintId: "annunciation",
  rank: "solemnity",
  applicableCommons: ["bvm"],
  nominalDate: (year) => utcDate(year, 3, 25),
  celebrationDate: (year) => {
    const nominal = utcDate(year, 3, 25);
    const palm = palmSunday(year);
    const easter = easterSunday(year);
    const secondSundayOfEaster = addDays(easter, 7);
    if (nominal >= palm && nominal <= secondSundayOfEaster) {
      return addDays(secondSundayOfEaster, 1);
    }
    if (nominal.getUTCDay() === 0) {
      return addDays(nominal, 1);
    }
    return nominal;
  },
};

/**
 * The registry of saints whose celebration we know how to compute.
 * Extend as the calendar is populated.
 */
export const GENERAL_ROMAN_CALENDAR_SAINTS: CalendarSaint[] = [
  ANNUNCIATION,
];

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
export function getSaintsOnDate(date: Date): CalendarSaint[] {
  const year = date.getUTCFullYear();
  const results: CalendarSaint[] = [];
  for (const saint of GENERAL_ROMAN_CALENDAR_SAINTS) {
    if (sameUtcDay(saint.celebrationDate(year), date) ||
        sameUtcDay(saint.celebrationDate(year - 1), date)) {
      results.push(saint);
    }
  }
  return results;
}
