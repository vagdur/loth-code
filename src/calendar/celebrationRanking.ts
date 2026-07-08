/**
 * GILH §4 celebration ranking and §5.5 memoria policy.
 */

import { addDays } from "./computus.js";
import { getBounds, getWeekday } from "./liturgicalYear.js";
import type { CalendarSaint } from "../types/sanctoralCalendar.js";
import type { Celebration, DayClass, Season } from "../types/calendar.js";
import type { SeasonalDayKey } from "../types/proper.js";
import type { Weekday } from "../types/psalter.js";

// ---------------------------------------------------------------------------
// Seasonal solemnities (rank 2 when they win)
// ---------------------------------------------------------------------------

export const SEASONAL_SOLEMNITY_KEYS: ReadonlySet<SeasonalDayKey> = new Set([
  "epiphany",
  "baptism_of_lord",
  "palm_sunday",
  "holy_thursday",
  "good_friday",
  "holy_saturday",
  "easter_sunday",
  "easter_sun",
  "easter_mon",
  "easter_tue",
  "easter_wed",
  "easter_thu",
  "easter_fri",
  "easter_sat",
  "ascension",
  "pentecost",
  "corpus_christi",
  "sacred_heart",
  "immaculate_heart",
  "christmas_dec25",
  "christmas_jan01",
  "trinity_sunday",
  "christ_the_king",
]);

/** Weekday solemnities with First Vespers (Sundays / Triduum handled elsewhere). */
export const SOLEMNITY_FIRST_VESPERS_KEYS: ReadonlySet<SeasonalDayKey> = new Set([
  "ascension",
  "corpus_christi",
  "sacred_heart",
  "immaculate_heart",
]);

/** Seasonal feasts of the Lord (rank as feast; on a Sunday they take its place). */
export const SEASONAL_FEAST_KEYS: ReadonlySet<SeasonalDayKey> = new Set([
  "holy_family",
]);

// ---------------------------------------------------------------------------
// GILH rank (lower number = higher liturgical rank)
// ---------------------------------------------------------------------------

const RANK: Record<DayClass, number> = {
  triduum: 1,
  solemnity: 2,
  feast_of_lord_on_sunday: 3,
  sunday: 4,
  feast: 5,
  obligatory_memoria: 6,
  optional_memoria: 6.1,
  privileged_ferial: 7,
  ordinary_ferial: 8,
};

export interface RankingContext {
  date: Date;
  season: Season;
  weekday: Weekday;
  seasonalKey: SeasonalDayKey | null;
}

export type ObservanceKind = "seasonal_frame" | "seasonal_solemnity" | "saint";

export interface ObservanceCandidate {
  kind: ObservanceKind;
  dayClass: DayClass;
  rank: number;
  seasonalKey?: SeasonalDayKey;
  saint?: CalendarSaint;
}

// ---------------------------------------------------------------------------
// §5.5 date helpers
// ---------------------------------------------------------------------------

export function isAdvent17Through24(date: Date): boolean {
  return date.getUTCMonth() === 11 && date.getUTCDate() >= 17 && date.getUTCDate() <= 24;
}

export function isAshWednesday(seasonalKey: SeasonalDayKey | null): boolean {
  return seasonalKey === "ash_wednesday";
}

export function isEasterOctaveWeekday(date: Date, season: Season): boolean {
  if (season !== "eastertide") return false;
  const b = getBounds(date);
  const easter = b.easterSunday;
  const weekday = date.getUTCDay();
  return date > easter && date <= addDays(easter, 7) && weekday !== 0;
}

export function isChristmasOctaveFerial(date: Date, season: Season): boolean {
  if (season !== "christmas") return false;
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  if (m === 12 && d === 25) return false;
  if (m === 1 && d === 1) return false;
  return true;
}

export function isLentenFerial(date: Date, season: Season, seasonalKey: SeasonalDayKey | null): boolean {
  return season === "lent" && !isAshWednesday(seasonalKey);
}

/** Class I.2 — saint solemnities cannot displace these days (GNLY 59). */
export function isClassI2Day(ctx: RankingContext): boolean {
  const { date, season, weekday } = ctx;
  if (season === "holy_week" || season === "easter_triduum") return true;
  if (weekday === "Sunday" &&
      (season === "advent" || season === "lent" || season === "eastertide")) {
    return true;
  }
  if (isEasterOctaveWeekday(date, season)) return true;
  return false;
}

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** True when the saint's celebration was moved onto `date` from another nominal day. */
export function isSaintTransferredOntoDate(
  saint: CalendarSaint,
  date: Date,
): boolean {
  const year = date.getUTCFullYear();
  if (sameUtcDay(saint.celebrationDate(year), date)) {
    return !sameUtcDay(saint.nominalDate(year), date);
  }
  if (sameUtcDay(saint.celebrationDate(year - 1), date)) {
    return !sameUtcDay(saint.nominalDate(year - 1), date);
  }
  return false;
}

export function isPrivilegedFerialSeason(season: Season, weekday: Weekday): boolean {
  return weekday !== "Sunday" &&
    (season === "advent" ||
      season === "christmas" ||
      season === "lent" ||
      season === "holy_week" ||
      season === "easter_triduum" ||
      season === "eastertide");
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export function buildSeasonalFrame(ctx: RankingContext): ObservanceCandidate {
  const { season, weekday } = ctx;

  if (season === "easter_triduum") {
    return { kind: "seasonal_frame", dayClass: "triduum", rank: RANK.triduum };
  }

  if (weekday === "Sunday") {
    return { kind: "seasonal_frame", dayClass: "sunday", rank: RANK.sunday };
  }

  if (isPrivilegedFerialSeason(season, weekday)) {
    return { kind: "seasonal_frame", dayClass: "privileged_ferial", rank: RANK.privileged_ferial };
  }

  return { kind: "seasonal_frame", dayClass: "ordinary_ferial", rank: RANK.ordinary_ferial };
}

export function buildSeasonalSolemnity(
  seasonalKey: SeasonalDayKey,
): ObservanceCandidate {
  return {
    kind: "seasonal_solemnity",
    dayClass: "solemnity",
    rank: RANK.solemnity,
    seasonalKey,
  };
}

/** Seasonal feast of the Lord (e.g. Holy Family) — replaces the Sunday when on one. */
export function buildSeasonalFeast(
  seasonalKey: SeasonalDayKey,
  weekday: Weekday,
): ObservanceCandidate {
  const dayClass: DayClass =
    weekday === "Sunday" ? "feast_of_lord_on_sunday" : "feast";
  return {
    kind: "seasonal_solemnity",
    dayClass,
    rank: RANK[dayClass],
    seasonalKey,
  };
}

export function buildSaintCandidate(
  saint: CalendarSaint,
  ctx: RankingContext,
): ObservanceCandidate {
  const { weekday, season } = ctx;
  const isSunday = weekday === "Sunday";
  const isOtSunday = isSunday && season === "ordinary_time";

  if (saint.rank === "solemnity") {
    let rank = RANK.solemnity;
    // A solemnity transferred onto this day is celebrated here, even on a
    // privileged Sunday (GNLY 60). Only a nominal coincidence on Class I.2
    // yields to the Sunday frame.
    if (isClassI2Day(ctx) && !isSaintTransferredOntoDate(saint, ctx.date)) {
      rank = 9;
    }
    return { kind: "saint", dayClass: "solemnity", rank, saint };
  }

  if (saint.rank === "feast") {
    if (saint.observanceOf === "lord" && isOtSunday) {
      return {
        kind: "saint",
        dayClass: "feast_of_lord_on_sunday",
        rank: RANK.feast_of_lord_on_sunday,
        saint,
      };
    }
    return { kind: "saint", dayClass: "feast", rank: RANK.feast, saint };
  }

  if (saint.rank === "obligatory_memoria") {
    return {
      kind: "saint",
      dayClass: "obligatory_memoria",
      rank: RANK.obligatory_memoria,
      saint,
    };
  }

  return {
    kind: "saint",
    dayClass: "optional_memoria",
    rank: RANK.optional_memoria,
    saint,
  };
}

export function compareObservances(
  a: ObservanceCandidate,
  b: ObservanceCandidate,
): number {
  if (a.rank !== b.rank) return a.rank - b.rank;
  // Stable tie-break: seasonal solemnity before saint at equal solemnity rank.
  if (a.kind !== b.kind) {
    const order: ObservanceKind[] = ["seasonal_solemnity", "saint", "seasonal_frame"];
    return order.indexOf(a.kind) - order.indexOf(b.kind);
  }
  if (a.saint && b.saint) {
    return a.saint.saintId.localeCompare(b.saint.saintId);
  }
  return 0;
}

export function pickBestCandidate(
  candidates: ObservanceCandidate[],
): ObservanceCandidate {
  return candidates.reduce((best, c) =>
    compareObservances(c, best) < 0 ? c : best,
  );
}

function pickBestSaint(
  saints: CalendarSaint[],
  ctx: RankingContext,
): ObservanceCandidate | null {
  if (saints.length === 0) return null;
  const candidates = saints.map((s) => buildSaintCandidate(s, ctx));
  return pickBestCandidate(candidates);
}

function isMemoriaRank(dayClass: DayClass): boolean {
  return dayClass === "obligatory_memoria" || dayClass === "optional_memoria";
}

function pickBestSuppressedMemoria(
  saints: CalendarSaint[],
  winner: ObservanceCandidate,
  ctx: RankingContext,
): CalendarSaint | null {
  const losers = saints
    .map((s) => buildSaintCandidate(s, ctx))
    .filter((c) => compareObservances(c, winner) > 0 && isMemoriaRank(c.dayClass));
  if (losers.length === 0) return null;
  const best = pickBestCandidate(losers);
  return best.saint ?? null;
}

// ---------------------------------------------------------------------------
// §5.5 memoria policy
// ---------------------------------------------------------------------------

export interface MemoriaPolicyFlags {
  memoriaFullySuppressed: boolean;
  memoriaReducedToOptional: boolean;
  allowMemoriaAddendum: boolean;
  saintId?: string;
}

export function appliesFullMemoriaSuppression(
  winner: ObservanceCandidate,
  ctx: RankingContext,
): boolean {
  const { dayClass } = winner;
  if (
    dayClass === "sunday" ||
    dayClass === "solemnity" ||
    dayClass === "feast" ||
    dayClass === "feast_of_lord_on_sunday" ||
    dayClass === "triduum"
  ) {
    return true;
  }
  if (isAshWednesday(ctx.seasonalKey)) return true;
  if (ctx.season === "holy_week") return true;
  if (isEasterOctaveWeekday(ctx.date, ctx.season)) return true;
  return false;
}

export function appliesPartialMemoriaSuppression(ctx: RankingContext): boolean {
  if (isAdvent17Through24(ctx.date)) return true;
  if (isChristmasOctaveFerial(ctx.date, ctx.season)) return true;
  if (isLentenFerial(ctx.date, ctx.season, ctx.seasonalKey)) return true;
  return false;
}

export function applyMemoriaPolicy(
  winner: ObservanceCandidate,
  suppressedSaint: CalendarSaint | null,
  ctx: RankingContext,
): MemoriaPolicyFlags {
  if (!suppressedSaint) {
    return {
      memoriaFullySuppressed: false,
      memoriaReducedToOptional: false,
      allowMemoriaAddendum: false,
    };
  }

  if (appliesFullMemoriaSuppression(winner, ctx)) {
    return {
      memoriaFullySuppressed: true,
      memoriaReducedToOptional: false,
      allowMemoriaAddendum: false,
    };
  }

  if (appliesPartialMemoriaSuppression(ctx)) {
    const isObligatory = suppressedSaint.rank === "obligatory_memoria";
    return {
      memoriaFullySuppressed: false,
      memoriaReducedToOptional: isObligatory,
      allowMemoriaAddendum: true,
      saintId: suppressedSaint.saintId,
    };
  }

  return {
    memoriaFullySuppressed: false,
    memoriaReducedToOptional: false,
    allowMemoriaAddendum: false,
  };
}

// ---------------------------------------------------------------------------
// Full resolution
// ---------------------------------------------------------------------------

export function resolveCelebrationFromParts(
  date: Date,
  season: Season,
  seasonalKey: SeasonalDayKey | null,
  saintsToday: CalendarSaint[],
): Celebration {
  const weekday = getWeekday(date);
  const ctx: RankingContext = { date, season, weekday, seasonalKey };
  const frame = buildSeasonalFrame(ctx);

  const candidates: ObservanceCandidate[] = [frame];

  // Seasonal solemnities observed on this date — including when transferred to
  // a Sunday (e.g. Corpus Christi on the second Sunday after Pentecost).
  if (seasonalKey !== null && SEASONAL_SOLEMNITY_KEYS.has(seasonalKey)) {
    candidates.push(buildSeasonalSolemnity(seasonalKey));
  }
  if (seasonalKey !== null && SEASONAL_FEAST_KEYS.has(seasonalKey)) {
    candidates.push(buildSeasonalFeast(seasonalKey, weekday));
  }

  const bestSaint = pickBestSaint(saintsToday, ctx);
  if (bestSaint) candidates.push(bestSaint);

  const winner = pickBestCandidate(candidates);

  const suppressedMemoria = pickBestSuppressedMemoria(saintsToday, winner, ctx);
  const memoriaFlags =
    winner.kind === "saint" && isMemoriaRank(winner.dayClass)
      ? {
          memoriaFullySuppressed: false,
          memoriaReducedToOptional: false,
          allowMemoriaAddendum: false,
        }
      : applyMemoriaPolicy(winner, suppressedMemoria, ctx);

  const isTriduum = season === "easter_triduum" || winner.dayClass === "triduum";

  const attachSeasonalKey = (key: SeasonalDayKey | null | undefined) =>
    key !== null && key !== undefined ? { seasonalKey: key } : {};

  if (winner.kind === "saint" && winner.saint) {
    const includeFerialKey =
      isMemoriaRank(winner.dayClass) && seasonalKey !== null;
    return {
      type: winner.dayClass,
      source: "saint",
      saintId: winner.saint.saintId,
      applicableCommons: winner.saint.applicableCommons,
      ...(includeFerialKey ? { seasonalKey } : {}),
      ...memoriaFlags,
      isTriduum,
    };
  }

  if (winner.kind === "seasonal_solemnity" && winner.seasonalKey) {
    return {
      type: winner.dayClass,
      source: "seasonal",
      seasonalKey: winner.seasonalKey,
      applicableCommons: [],
      ...memoriaFlags,
      isTriduum,
    };
  }

  return {
    type: winner.dayClass,
    source: "seasonal",
    ...attachSeasonalKey(seasonalKey),
    applicableCommons: [],
    ...memoriaFlags,
    isTriduum,
  };
}

/** True when today's Second Vespers outranks a Class I.3 saint's First Vespers. */
export function todayOutranksI3FirstVespers(
  date: Date,
  season: Season,
  seasonalKey: SeasonalDayKey | null = null,
): boolean {
  return isClassI2Day({ date, season, weekday: getWeekday(date), seasonalKey });
}

/** Whether tomorrow's celebration has First Vespers this evening. */
export function tomorrowHasFirstVespers(
  tomorrowCelebration: Celebration,
  tomorrowSeasonalKey: SeasonalDayKey | null,
  tomorrowWeekday: Weekday,
  tomorrowSeason: Season,
): boolean {
  if (tomorrowWeekday === "Sunday") return true;
  if (tomorrowSeason === "easter_triduum") return true;
  if (
    tomorrowSeasonalKey !== null &&
    SOLEMNITY_FIRST_VESPERS_KEYS.has(tomorrowSeasonalKey)
  ) {
    return true;
  }
  if (tomorrowCelebration.type === "solemnity") return true;
  if (tomorrowCelebration.type === "feast_of_lord_on_sunday") return true;
  return false;
}
