/**
 * Calendar resolution — public API.
 *
 * Given a civil date and calendar identifier, produces a LiturgicalDay
 * describing every parameter needed by the hour builders.
 */

import { addDays } from "./computus.js";
import {
  enumerateCelebrationAlternatives,
  resolveCelebrationFromParts,
  todayOutranksI3FirstVespers,
  tomorrowHasFirstVespers,
} from "./celebrationRanking.js";
import type { CelebrationAlternative } from "./celebrationRanking.js";
import type { DayChoices } from "../types/options.js";
import {
  getOrdinaryTimeWeek, getPsalterWeek, getReadingYear,
  getSeason, getSeasonalDayKey, getSundayCycle, getWeekday,
} from "./liturgicalYear.js";
import { getSaintsOnDate } from "./saints.js";
import type {
  AssemblyContext, Celebration, EveningContext, LiturgicalDay, Season,
} from "../types/calendar.js";
import type { SeasonalDayKey } from "../types/proper.js";

// ---------------------------------------------------------------------------
// Main resolution function
// ---------------------------------------------------------------------------

/**
 * Resolve the LiturgicalDay for a civil date.
 *
 * `choices` may carry a `celebration` choice id (see
 * enumerateDayCelebrationAlternatives); an absent or stale id silently
 * falls back to the default celebration.  Choices apply to THIS day only —
 * this evening's First Vespers belongs to tomorrow's default celebration,
 * since tomorrow's choices are a separate per-day concern for the caller.
 */
export function resolveDay(
  date: Date,
  _calendarId: string,
  choices?: DayChoices,
): LiturgicalDay {
  const season = getSeason(date, _calendarId);
  const psalterWeek = getPsalterWeek(date, _calendarId);
  const psalterDay = getWeekday(date);
  const readingYear = getReadingYear(date);
  const sundayCycle = getSundayCycle(date);
  const ordinaryTimeWeek = getOrdinaryTimeWeek(date, _calendarId);
  const seasonalKey = getSeasonalDayKey(date, _calendarId);

  const defaultCelebration = resolveCelebration(date, season, seasonalKey, _calendarId);
  const chosenId = choices?.["celebration"];
  const celebration =
    chosenId !== undefined
      ? enumerateDayCelebrationAlternatives(date, _calendarId)
          .find((a) => a.choiceId === chosenId)?.celebration ?? defaultCelebration
      : defaultCelebration;
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
    sundayCycle,
    ordinaryTimeWeek,
    celebration,
    evening,
    saturdayBvmPermitted,
  };
}

/**
 * The celebrations that may be observed on this date (feria, optional
 * memorials, Saturday BVM), with the default marked.  A single-entry result
 * means the day admits no celebration choice.
 */
export function enumerateDayCelebrationAlternatives(
  date: Date,
  calendarId: string,
): CelebrationAlternative[] {
  const season = getSeason(date, calendarId);
  const seasonalKey = getSeasonalDayKey(date, calendarId);
  const saintsToday = getSaintsOnDate(date, calendarId);
  return enumerateCelebrationAlternatives(date, season, seasonalKey, saintsToday);
}

// ---------------------------------------------------------------------------
// Celebration resolution
// ---------------------------------------------------------------------------

function resolveCelebration(
  date: Date,
  season: Season,
  seasonalKey: SeasonalDayKey | null,
  calendarId: string,
): Celebration {
  const saintsToday = getSaintsOnDate(date, calendarId);
  return resolveCelebrationFromParts(date, season, seasonalKey, saintsToday);
}

// ---------------------------------------------------------------------------
// Evening / First Vespers resolution
// ---------------------------------------------------------------------------

/**
 * Determine whether this evening is First Vespers of tomorrow.
 *
 * Deliberately does NOT call resolveDay (would recurse).  Instead it
 * re-derives only the minimal properties needed to answer the question.
 */
function resolveEvening(date: Date, calendarId: string): EveningContext {
  const tomorrow = addDays(date, 1);
  const tomorrowSeason = getSeason(tomorrow, calendarId);
  const tomorrowSeasonalKey = getSeasonalDayKey(tomorrow, calendarId);
  const tomorrowWeekday = getWeekday(tomorrow);
  const todaySeason = getSeason(date, calendarId);
  const todaySeasonalKey = getSeasonalDayKey(date, calendarId);

  const tomorrowCelebration = resolveCelebration(
    tomorrow,
    tomorrowSeason,
    tomorrowSeasonalKey,
    calendarId,
  );

  const seasonalFirstVespers = tomorrowHasFirstVespers(
    tomorrowCelebration,
    tomorrowSeasonalKey,
    tomorrowWeekday,
    tomorrowSeason,
  );

  const tomorrowHasSaintSolemnity =
    tomorrowCelebration.type === "solemnity" &&
    tomorrowCelebration.source === "saint";

  const saintFirstVespers =
    tomorrowHasSaintSolemnity &&
    !todayOutranksI3FirstVespers(date, todaySeason, todaySeasonalKey);

  const hasFirstVespers = seasonalFirstVespers || saintFirstVespers;

  if (hasFirstVespers) {
    return {
      hasFirstVespers: true,
      firstVespersCelebration: tomorrowCelebration,
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
export * from "./saints.js";
export * from "./sanctoralRegistry.js";
export * from "./transferRules.js";
export * from "./seasonalObservance.js";
export {
  BVM_SATURDAY_SAINT_ID,
  enumerateCelebrationAlternatives,
  resolveCelebrationFromParts,
  SEASONAL_SOLEMNITY_KEYS,
  SOLEMNITY_FIRST_VESPERS_KEYS,
} from "./celebrationRanking.js";
export type { CelebrationAlternative } from "./celebrationRanking.js";
