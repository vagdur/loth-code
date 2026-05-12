/**
 * Calendar resolution — public API.
 *
 * Given a civil date and calendar identifier, produces a LiturgicalDay
 * describing every parameter needed by the hour builders.
 */

import { addDays } from "./computus.js";
import {
  getBounds, getOrdinaryTimeWeek, getPsalterWeek, getReadingYear,
  getSeason, getSeasonalDayKey, getWeekday,
} from "./liturgicalYear.js";
import { getSaintsOnDate, type CalendarSaint } from "./saints.js";
import type {
  AssemblyContext, Celebration, DayClass, EveningContext, LiturgicalDay, Season,
} from "../types/calendar.js";
import type { SeasonalDayKey } from "../types/proper.js";

/**
 * Solemnities that fall on a weekday and therefore need First Vespers
 * detected explicitly (Sundays and the Triduum are handled elsewhere).
 */
const SOLEMNITY_FIRST_VESPERS_KEYS = new Set<SeasonalDayKey>([
  "ascension",
  "corpus_christi",
  "sacred_heart",
  "immaculate_heart",
]);

// ---------------------------------------------------------------------------
// Main resolution function
// ---------------------------------------------------------------------------

export function resolveDay(
  date: Date,
  _calendarId: string,
): LiturgicalDay {
  const season = getSeason(date);
  const psalterWeek = getPsalterWeek(date);
  const psalterDay = getWeekday(date);
  const readingYear = getReadingYear(date);
  const ordinaryTimeWeek = getOrdinaryTimeWeek(date);
  const seasonalKey = getSeasonalDayKey(date);

  const celebration = resolveCelebration(date, season, seasonalKey);
  const evening = resolveEvening(date, _calendarId);

  const saturdayBvmPermitted =
    psalterDay === "Saturday" &&
    celebration.type === "ordinary_ferial" &&
    !celebration.memoriaFullySuppressed;

  return {
    date,
    season,
    psalterWeek,
    psalterDay,
    readingYear,
    ordinaryTimeWeek,
    celebration,
    evening,
    saturdayBvmPermitted,
  };
}

// ---------------------------------------------------------------------------
// Celebration resolution
// ---------------------------------------------------------------------------

function resolveCelebration(
  date: Date,
  season: Season,
  seasonalKey: SeasonalDayKey | null,
): Celebration {
  // A saint solemnity celebrated on this date — either nominally here
  // or transferred onto this date — outranks Sundays of OT / Christmastide
  // and any ferial day (GNLY 59, Class I.3).  Transferable solemnities have
  // already been moved off Class I.1–I.2 days by their celebrationDate()
  // function, so any solemnity still landing here may simply win.
  // TODO: feasts and memorias, with privileged-season suppression.
  const saintsToday = getSaintsOnDate(date);
  const solemnity = saintsToday.find((s) => s.rank === "solemnity");
  if (solemnity) {
    return saintSolemnityCelebration(solemnity);
  }

  const weekday = getWeekday(date);
  const isSunday = weekday === "Sunday";

  // Privileged-season ferials (non-Sunday days in Advent, Christmas octave,
  // Holy Week, Lent, Eastertide) override ordinary memorias.
  const isPrivilegedFerial =
    !isSunday &&
    (season === "advent" ||
      season === "christmas" ||
      season === "lent" ||
      season === "holy_week" ||
      season === "easter_triduum" ||
      season === "eastertide");

  const type: DayClass = isSunday
    ? "sunday"
    : isPrivilegedFerial
    ? "privileged_ferial"
    : "ordinary_ferial";

  return {
    type,
    source: "seasonal",
    // exactOptionalPropertyTypes: only include seasonalKey when it has a value.
    ...(seasonalKey !== null ? { seasonalKey } : {}),
    applicableCommons: [],
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: season === "easter_triduum",
  };
}

function saintSolemnityCelebration(saint: CalendarSaint): Celebration {
  return {
    type: "solemnity",
    source: "saint",
    saintId: saint.saintId,
    applicableCommons: saint.applicableCommons,
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
    isTriduum: false,
  };
}

// ---------------------------------------------------------------------------
// Evening / First Vespers resolution
// ---------------------------------------------------------------------------

/**
 * Determine whether this evening is First Vespers of tomorrow.
 *
 * Deliberately does NOT call resolveDay (would recurse).  Instead it
 * re-derives only the minimal properties needed to answer the question:
 * is tomorrow a Sunday or a high-ranking feast?
 */
function resolveEvening(date: Date, _calendarId: string): EveningContext {
  const tomorrow = addDays(date, 1);

  const tomorrowWeekday = getWeekday(tomorrow);
  const tomorrowSeason  = getSeason(tomorrow);
  const tomorrowSeasonalKey = getSeasonalDayKey(tomorrow);

  // First Vespers for Sundays, the Triduum, and weekday solemnities of the
  // season (seasonal moveables, e.g. Ascension, Corpus Christi).
  const seasonalFirstVespers =
    tomorrowWeekday === "Sunday" ||
    tomorrowSeason === "easter_triduum" ||
    (tomorrowSeasonalKey !== null &&
      SOLEMNITY_FIRST_VESPERS_KEYS.has(tomorrowSeasonalKey));

  // First Vespers of a saint solemnity celebrated tomorrow (whether on its
  // nominal date or transferred here).  GNLY 61: if today is itself a higher-
  // ranking day (Class I.1–I.2) its Second Vespers outranks the saint's First
  // Vespers, so the latter is suppressed.
  const tomorrowSaintSolemnity =
    getSaintsOnDate(tomorrow).find((s) => s.rank === "solemnity");
  const saintFirstVespers =
    tomorrowSaintSolemnity !== undefined &&
    !todayOutranksI3FirstVespers(date);

  const hasFirstVespers = seasonalFirstVespers || saintFirstVespers;

  if (hasFirstVespers) {
    return {
      hasFirstVespers: true,
      firstVespersCelebration: resolveCelebration(tomorrow, tomorrowSeason, tomorrowSeasonalKey),
    };
  }
  return { hasFirstVespers: false };
}

/**
 * True if today's Second Vespers belongs to a Class I.1–I.2 liturgical day
 * (GNLY 59) and therefore outranks First Vespers of a Class I.3 solemnity
 * (universal-calendar saint) that would otherwise begin this evening.
 *
 * Class I.2 includes: Sundays of Advent, Lent, and Easter; all of Holy Week;
 * the Easter Triduum; and every day of the Easter Octave.
 */
function todayOutranksI3FirstVespers(date: Date): boolean {
  const season = getSeason(date);
  if (season === "holy_week" || season === "easter_triduum") return true;

  const weekday = getWeekday(date);
  if (weekday === "Sunday" &&
      (season === "advent" || season === "lent" || season === "eastertide")) {
    return true;
  }

  // Weekdays Mon–Sat of the Easter Octave (the Octave Sunday is caught above).
  if (season === "eastertide") {
    const b = getBounds(date);
    const easter = b.easterSunday;
    if (date > easter && date <= addDays(easter, 7)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Default AssemblyContext — sensible defaults for solo recitation
// ---------------------------------------------------------------------------

export function defaultContext(calendarId = "general"): AssemblyContext {
  return {
    daytimeHoursSaid: ["sext"],
    oorIsFirstHour: false,
    laudsFollowsOorDirectly: false,
    oorSaidAtNight: false,
    complineFollows: "after_ferial_vespers",
    calendarId,
  };
}

export * from "./computus.js";
export * from "./liturgicalYear.js";
export * from "./saints.js";
