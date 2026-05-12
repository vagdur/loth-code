/**
 * Calendar resolution — public API.
 *
 * Given a civil date and calendar identifier, produces a LiturgicalDay
 * describing every parameter needed by the hour builders.
 */

import {
  getBounds, getOrdinaryTimeWeek, getPsalterWeek, getReadingYear,
  getSeason, getSeasonalDayKey, getWeekday,
} from "./liturgicalYear.js";
import type {
  AssemblyContext, Celebration, DayClass, EveningContext, LiturgicalDay, Season,
} from "../types/calendar.js";
import type { CommonType, SeasonalDayKey } from "../types/proper.js";

// ---------------------------------------------------------------------------
// General Roman Calendar entries (stub — extend with real data)
// ---------------------------------------------------------------------------

// TODO: load from data/calendar/general_roman_calendar.yaml
// For now: an empty map; saints can be added as SaintEntry items in the
// proper_of_saints collection.
const GENERAL_ROMAN_CALENDAR: Map<string, { saintId: string; rank: DayClass }[]> =
  new Map();

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
  // TODO: look up saints from the calendar for this date,
  // rank them, apply privileged-season suppression rules,
  // and pick the highest-ranking celebration.
  //
  // For now: return a basic ferial or Sunday celebration.

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

// ---------------------------------------------------------------------------
// Evening / First Vespers resolution
// ---------------------------------------------------------------------------

/**
 * Determine whether this evening is First Vespers of tomorrow.
 *
 * Deliberately does NOT call resolveDay (would recurse).  Instead it
 * re-derives only the minimal properties needed to answer the question:
 * is tomorrow a Sunday or a high-ranking feast?
 *
 * TODO: once saint lookup is implemented, check tomorrow's calendar entry
 * here so that solemnities of saints also trigger First Vespers.
 */
function resolveEvening(date: Date, _calendarId: string): EveningContext {
  const tomorrow = new Date(date);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const tomorrowWeekday = getWeekday(tomorrow);
  const tomorrowSeason  = getSeason(tomorrow);
  const tomorrowSeasonalKey = getSeasonalDayKey(tomorrow);

  // First Vespers for Sundays, the Triduum, and weekday solemnities.
  // Solemnities of saints will be added here once the calendar is populated.
  const hasFirstVespers =
    tomorrowWeekday === "Sunday" ||
    tomorrowSeason === "easter_triduum" ||
    (tomorrowSeasonalKey !== null &&
      SOLEMNITY_FIRST_VESPERS_KEYS.has(tomorrowSeasonalKey));

  if (hasFirstVespers) {
    return {
      hasFirstVespers: true,
      firstVespersCelebration: resolveCelebration(tomorrow, tomorrowSeason, tomorrowSeasonalKey),
    };
  }
  return { hasFirstVespers: false };
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
