/**
 * Liturgical year — season determination, psalter week, OT week number,
 * and SeasonalDayKey computation for any civil date.
 */

import {
  addDays, ashWednesday, christTheKing, daysBetween, easterSunday,
  firstOrdinaryTimeSunday, firstSundayOfAdvent, goodFriday, holyThursday,
  holySaturday, immaculateHeartOfMary, palmSunday, pentecost, sacredHeart,
  trinitySunday, utcDate,
} from "./computus.js";
import { getSeasonalObservance } from "./saints.js";
import {
  baptismOfTheLordForPolicy,
  observanceDate,
} from "./seasonalObservance.js";
import type { ReadingYear, Season } from "../types/calendar.js";
import type { SundayCycle } from "../types/melody.js";
import type { PsalterWeek, Weekday } from "../types/psalter.js";
import type { SeasonalDayKey } from "../types/proper.js";

// ---------------------------------------------------------------------------
// Season boundaries
// ---------------------------------------------------------------------------

interface LiturgicalYearBounds {
  // Advent
  adventStart: Date;
  christmasStart: Date;   // Dec 25
  // OT I
  otIStart: Date;         // Monday after Baptism of Lord
  lentStart: Date;        // Ash Wednesday
  holyWeekStart: Date;    // Palm Sunday
  triduumStart: Date;     // Holy Thursday
  easterSunday: Date;
  easterMondayStart: Date;
  pentecostDate: Date;
  // OT II
  otIIStart: Date;        // Monday after Pentecost
  nextAdventStart: Date;
}

/** Compute the boundaries of the liturgical year that CONTAINS the given civil date. */
export function getBounds(date: Date, calendarId = "general"): LiturgicalYearBounds {
  // Determine which civil year the current liturgical year started in.
  // Advent for liturgical year Y starts in civil year Y-1.
  const year = date.getUTCFullYear();

  // The liturgical year can start in November/December of the previous civil year.
  // We need to figure out whether `date` is before or after Advent of `year`.
  const adventThisYear = firstSundayOfAdvent(year);
  // The liturgical year that started in `year-1`'s Advent:
  const adventPrevYear = firstSundayOfAdvent(year - 1);

  // If date is on or after this year's Advent, we're in the NEXT liturgical year.
  const liturgicalYearStart = date >= adventThisYear ? year : year - 1;
  const liturgicalYearEnd = liturgicalYearStart + 1;

  const policy = getSeasonalObservance(calendarId);
  const bap = baptismOfTheLordForPolicy(liturgicalYearEnd, policy.epiphany);
  const easter = easterSunday(liturgicalYearEnd);

  return {
    adventStart:      firstSundayOfAdvent(liturgicalYearStart),
    christmasStart:   utcDate(liturgicalYearStart, 12, 25),
    otIStart:         addDays(bap, 1),                    // Monday after Baptism
    lentStart:        ashWednesday(liturgicalYearEnd),
    holyWeekStart:    palmSunday(liturgicalYearEnd),
    triduumStart:     holyThursday(liturgicalYearEnd),    // evening begins Triduum
    easterSunday:     easter,
    easterMondayStart: addDays(easter, 1),
    pentecostDate:    pentecost(liturgicalYearEnd),
    otIIStart:        addDays(pentecost(liturgicalYearEnd), 1),
    nextAdventStart:  firstSundayOfAdvent(liturgicalYearEnd),
  };
}

// ---------------------------------------------------------------------------
// Season
// ---------------------------------------------------------------------------

export function getSeason(date: Date, calendarId = "general"): Season {
  const b = getBounds(date, calendarId);
  if (date >= b.adventStart && date < b.christmasStart)  return "advent";
  if (date >= b.christmasStart && date < b.otIStart)     return "christmas";
  if (date >= b.otIStart && date < b.lentStart)          return "ordinary_time";
  if (date >= b.lentStart && date < b.holyWeekStart)     return "lent";
  if (date >= b.holyWeekStart && date < b.triduumStart)  return "holy_week";
  if (date >= b.triduumStart && date <= b.easterSunday)  return "easter_triduum";
  if (date > b.easterSunday && date <= b.pentecostDate)  return "eastertide";
  // OT II: Monday after Pentecost until Saturday before Advent
  return "ordinary_time";
}

// ---------------------------------------------------------------------------
// Psalter week
// ---------------------------------------------------------------------------

/**
 * Returns the psalter week (I–IV) for a given date.
 *
 * Anchor Sundays always begin Week I:
 *   - First Sunday of Advent
 *   - First Sunday of Ordinary Time (after Baptism of Lord)
 *   - First Sunday of Lent
 *   - Easter Sunday
 *
 * Between anchors the cycle runs continuously; weeks before an anchor
 * that would precede its Week I are simply omitted.
 */
export function getPsalterWeek(date: Date, calendarId = "general"): PsalterWeek {
  const b = getBounds(date, calendarId);
  const policy = getSeasonalObservance(calendarId);

  // Find the most recent anchor Sunday on or before `date`.
  const anchors: Date[] = [
    b.adventStart,
    firstOrdinaryTimeSunday(b.easterSunday.getUTCFullYear()),
    b.lentStart,  // Ash Wed is Wednesday; first anchor is Palm Sunday - see note below
    b.easterSunday,
  ];

  // Note: "First Sunday of Lent" is the anchor, not Ash Wednesday.
  // Ash Wednesday falls mid-week in Week N of OT; the psalter continues
  // until Palm Sunday begins Holy Week with proper psalmody.
  // The "First Sunday of Lent" anchor overrides the preceding OT psalter.
  const firstSundayOfLent = addDays(ashWednesday(b.easterSunday.getUTCFullYear()), 4);
  anchors[2] = firstSundayOfLent;

  // Replace the first Sunday of OT for the correct year:
  const baptism = baptismOfTheLordForPolicy(
    b.easterSunday.getUTCFullYear(),
    policy.epiphany,
  );
  anchors[1] = addDays(baptism, 7); // first OT Sunday

  // Find the latest anchor that is <= date
  let anchor: Date | null = null;
  for (const a of anchors) {
    if (a <= date && (anchor === null || a > anchor)) {
      anchor = a;
    }
  }

  if (anchor === null) {
    // Should not happen for a valid date in the liturgical year.
    return 1;
  }

  const weeksSinceAnchor = Math.floor(daysBetween(date, anchor) / 7);
  return ((weeksSinceAnchor % 4) + 1) as PsalterWeek;
}

// ---------------------------------------------------------------------------
// Ordinary Time week number (for OoR reading selection)
// ---------------------------------------------------------------------------

/**
 * True when Ordinary Time has only 33 weeks this year (GILH 152): the week
 * immediately after Pentecost is omitted so end-of-year readings are preserved.
 * Occurs when six or more OT weeks fall before Ash Wednesday.
 */
function omitWeekAfterPentecost(year: number, otIStart: Date): boolean {
  const weeksBeforeLent =
    Math.floor(daysBetween(ashWednesday(year), otIStart) / 7) + 1;
  return weeksBeforeLent >= 6;
}

/**
 * Returns the Ordinary Time week number (1–34), or 0 if not in OT.
 * Weeks are Monday-anchored (otIStart / otIIStart are Mondays): Mon–Sun share
 * a week number. After Pentecost the numbering continues from where Lent
 * interrupted it; in 33-week years the week after Pentecost is skipped (GILH 152).
 *
 * Sunday gospel antiphons / Ordo Sunday numbers use {@link getSundayUnderYearNumber}
 * instead — Monday-anchoring leaves OT Sundays one ordinal low in many years.
 */
export function getOrdinaryTimeWeek(date: Date, calendarId = "general"): number {
  const season = getSeason(date, calendarId);
  if (season !== "ordinary_time") return 0;

  const b = getBounds(date, calendarId);
  const year = b.easterSunday.getUTCFullYear();
  const policy = getSeasonalObservance(calendarId);
  const otIStart = addDays(
    baptismOfTheLordForPolicy(year, policy.epiphany),
    1,
  );

  if (date >= b.otIIStart) {
    // After Pentecost: determine how many OT weeks elapsed before Lent,
    // then continue from the week after the one Lent interrupted.
    const lentInterruptedWeek = Math.floor(
      daysBetween(ashWednesday(year), otIStart) / 7
    ) + 1;
    const weeksSincePentecost = Math.floor(daysBetween(date, b.otIIStart) / 7);
    const skipAfterPentecost = omitWeekAfterPentecost(year, otIStart) ? 1 : 0;
    // Skip the Sunday readings of the interrupted week; in 33-week years also
    // skip the week immediately after Pentecost (local_adjustments §7).
    return Math.min(
      34,
      lentInterruptedWeek + weeksSincePentecost + 1 + skipAfterPentecost,
    );
  } else {
    // Before Lent (OT I)
    return Math.floor(daysBetween(date, otIStart) / 7) + 1;
  }
}

/**
 * Ordinal of a Sunday "under året" in Swedish LOH / Ordo reckoning (1–34).
 * Baptism of the Lord stands in for the 1st Sunday; Christ the King is always
 * the 34th. Maps Monday-anchored {@link getOrdinaryTimeWeek} onto that scale so
 * `ot_wN_sun` propers match the Ordo Sunday number.
 */
export function getSundayUnderYearNumber(
  date: Date,
  calendarId = "general",
): number {
  const otWeek = getOrdinaryTimeWeek(date, calendarId);
  if (otWeek <= 0) return 0;

  const b = getBounds(date, calendarId);
  if (date < b.otIIStart) {
    // OT I: Monday-anchored week 1 ends on the 2nd Sunday under året.
    return otWeek + 1;
  }

  // OT II: shift so Christ the King lands on 34 (covers years where the
  // Monday-anchored CTK week is 32–34 depending on Lent/Pentecost spacing).
  const ctk = christTheKing(b.nextAdventStart.getUTCFullYear());
  const ctkWeek = getOrdinaryTimeWeek(ctk, calendarId);
  return otWeek - ctkWeek + 34;
}

// ---------------------------------------------------------------------------
// Weekday
// ---------------------------------------------------------------------------

const WEEKDAYS: Weekday[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function getWeekday(date: Date): Weekday {
  return WEEKDAYS[date.getUTCDay()] as Weekday;
}

// ---------------------------------------------------------------------------
// Reading year
// ---------------------------------------------------------------------------

/** Year I = odd civil year of the CURRENT liturgical year start; Year II = even. */
export function getReadingYear(date: Date): ReadingYear {
  const b = getBounds(date);
  const liturgicalStartYear = b.adventStart.getUTCFullYear();
  return liturgicalStartYear % 2 !== 0 ? "I" : "II";
}

// ---------------------------------------------------------------------------
// Sunday lectionary cycle
// ---------------------------------------------------------------------------

/**
 * Year A/B/C keyed to the civil year the liturgical year ENDS in:
 * divisible by 3 → C, remainder 1 → A, remainder 2 → B.
 * (E.g. Advent 2024–Christ the King 2025 is Year C; Advent 2025 begins Year A.)
 */
export function getSundayCycle(date: Date): SundayCycle {
  const b = getBounds(date);
  const liturgicalEndYear = b.adventStart.getUTCFullYear() + 1;
  switch (liturgicalEndYear % 3) {
    case 1:  return "A";
    case 2:  return "B";
    default: return "C";
  }
}

// ---------------------------------------------------------------------------
// SeasonalDayKey
// ---------------------------------------------------------------------------

/**
 * Computes the SeasonalDayKey for a given date.
 * Returns null if the date is not covered by the seasonal proper
 * (e.g., an ordinary ferial day with no seasonal key needed).
 */
export function getSeasonalDayKey(
  date: Date,
  calendarId = "general",
): SeasonalDayKey | null {
  const policy = getSeasonalObservance(calendarId);
  const season = getSeason(date, calendarId);
  const b = getBounds(date, calendarId);
  const year = b.easterSunday.getUTCFullYear();
  const wd = getWeekday(date).toLowerCase().slice(0, 3); // "sun", "mon", ...
  const dow = date.getUTCDay();

  switch (season) {
    case "advent": {
      const m = date.getUTCMonth() + 1; // 1-based
      const d = date.getUTCDate();
      // Special days 17–24 December override the weekly scheme.
      if (m === 12 && d >= 17 && d <= 24) return `advent_dec${d}`;
      const week = Math.floor(daysBetween(date, b.adventStart) / 7) + 1;
      return `advent_w${week}_${wd}`;
    }

    case "christmas": {
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      if (m === 12 && d === 25) return "christmas_dec25";
      if (m === 12 && d >= 26 && d <= 31) {
        // Holy Family: the Sunday within the octave, or Dec 30 when
        // Christmas itself falls on Sunday (no free Sunday in the octave).
        const christmasDow = utcDate(date.getUTCFullYear(), 12, 25).getUTCDay();
        const isHolyFamily =
          christmasDow === 0 ? d === 30 : date.getUTCDay() === 0;
        if (isHolyFamily) return "holy_family";
      }
      if (m === 12) return `christmas_dec${d}`;
      if (m === 1 && d === 1) return "christmas_jan01";
      if (m === 1 && d >= 2 && d <= 5) return `christmas_jan0${d}`;
      const epiphanyDate = observanceDate("epiphany", year, policy);
      const baptismDate = baptismOfTheLordForPolicy(year, policy.epiphany);
      if (daysBetween(date, epiphanyDate) === 0) return "epiphany";
      if (date > epiphanyDate && date < baptismDate) {
        return `epiphany_${wd}`;
      }
      if (daysBetween(date, baptismDate) === 0) return "baptism_of_lord";
      return null;
    }

    case "lent": {
      const lentWeek = Math.floor(daysBetween(date, b.lentStart) / 7) + 1;
      if (daysBetween(date, b.lentStart) === 0) return "ash_wednesday";
      // Days within Lent Week 1 that are before the first Sunday:
      const firstSundayOfLent = addDays(b.lentStart, 4); // Ash Wed is Wed; Sun is +4
      if (date < firstSundayOfLent) return `lent_w1_${wd}`;
      const week = Math.floor(daysBetween(date, firstSundayOfLent) / 7) + 1;
      return `lent_w${week}_${wd}`;
    }

    case "holy_week": {
      if (dow === 0) return "palm_sunday";
      const names = ["", "holy_monday", "holy_tuesday", "holy_wednesday"];
      return names[dow] ?? null;
    }

    case "easter_triduum": {
      const diff = daysBetween(date, b.triduumStart);
      if (diff === 0) return "holy_thursday";
      if (diff === 1) return "good_friday";
      if (diff === 2) return "holy_saturday";
      if (diff === 3) return "easter_sunday";
      return null;
    }

    case "eastertide": {
      const diff = daysBetween(date, b.easterSunday);
      if (diff === 0) return "easter_sunday";
      // Octave weekdays (Mon–Sat). Day 7 is already the 2nd Sunday of Easter.
      if (diff < 7) {
        const names = [
          "easter_sun", "easter_mon", "easter_tue", "easter_wed",
          "easter_thu", "easter_fri", "easter_sat",
        ];
        return names[diff] ?? null;
      }
      if (daysBetween(date, observanceDate("ascension", year, policy)) === 0) {
        return "ascension";
      }
      if (daysBetween(date, pentecost(year)) === 0) return "pentecost";
      // Easter Sunday opens week 1, so day 7 begins easter_w2 (2nd Sunday).
      const week = Math.floor(diff / 7) + 1;
      return `easter_w${week}_${wd}`;
    }

    case "ordinary_time": {
      if (daysBetween(date, trinitySunday(year)) === 0) return "trinity_sunday";
      if (daysBetween(date, observanceDate("corpus_christi", year, policy)) === 0) {
        return "corpus_christi";
      }
      if (daysBetween(date, sacredHeart(year)) === 0) return "sacred_heart";
      if (daysBetween(date, immaculateHeartOfMary(year)) === 0) return "immaculate_heart";
      if (
        daysBetween(date, christTheKing(b.nextAdventStart.getUTCFullYear())) === 0
      ) {
        return "christ_the_king";
      }
      // Sundays use Ordo Sunday numbers (ot_w18_sun = 18th Sunday); weekdays
      // keep the Monday-anchored OT week used for ferial propers / OoR.
      const otWeek =
        dow === 0
          ? getSundayUnderYearNumber(date, calendarId)
          : getOrdinaryTimeWeek(date, calendarId);
      if (otWeek > 0) return `ot_w${otWeek}_${wd}`;
      return null;
    }

    default:
      return null;
  }
}
