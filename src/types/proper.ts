/**
 * Proper of Seasons, Proper of Saints, and Commons.
 *
 * All fields are optional in seasonal/sanctoral propers — absent means
 * "no override; fall back to the next source in the chain."
 * Common entries have all fields present (they are the guaranteed terminus).
 */

import type {
  Antiphon, BiblicalReading, ConcludingPrayer, HagiographicalReading,
  Hymn, Intercessions, OorHymnSet, PatristicReading,
  PsalmAssignment, ShortReading, ShortResponsory, Versicle,
} from "./texts.js";

// ---------------------------------------------------------------------------
// Season key type
// ---------------------------------------------------------------------------

/**
 * A stable string key identifying a day's position in the liturgical year,
 * independent of civil calendar year.  Examples:
 *   "advent_w1_sun", "advent_dec17", "lent_w2_mon",
 *   "ascension", "pentecost", "easter_w3_fri",
 *   "trinity_sunday", "corpus_christi", "sacred_heart", "christ_the_king", "ot_w8_tue"
 *
 * Full enumeration is in data-structure.md §5.1.
 */
export type SeasonalDayKey = string;

// ---------------------------------------------------------------------------
// Shared slot shapes (reused by seasonal proper, sanctoral proper, and common)
// ---------------------------------------------------------------------------

export interface VespersProperSlot {
  /** Propers carry ONE hymn per hour (week-parity series is a psalter concept). */
  hymn?: Hymn;
  /** Proper psalm assignments (present on solemnities / feasts). */
  psalmAssignments?: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
  shortReading?: ShortReading;
  shortResponsory?: ShortResponsory;
  magnificatAntiphon?: Antiphon;
  intercessions?: Intercessions;
  concludingPrayer?: ConcludingPrayer;
}

export interface LaudsProperSlot {
  /** Propers carry ONE hymn per hour (week-parity series is a psalter concept). */
  hymn?: Hymn;
  /** Proper psalm assignments (rare for saints; present on solemnities). */
  psalmAssignments?: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
  shortReading?: ShortReading;
  shortResponsory?: ShortResponsory;
  benedictusAntiphon?: Antiphon;
  intercessions?: Intercessions;
  concludingPrayer?: ConcludingPrayer;
}

export interface OorProperSlot {
  hymn?: Hymn;
  /** Proper psalm assignments (Triduum, octaves, solemnities, feasts). */
  psalmAssignments?: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
  versicle?: Versicle;
  // Standard single-year Office of Readings reading cycle:
  biblicalReading?: BiblicalReading;
  patristicReading?: PatristicReading;
  // Optional two-year supplement:
  biblicalReadingYr1?: BiblicalReading;
  biblicalReadingYr2?: BiblicalReading;
  patristicReadingYr1?: PatristicReading;
  patristicReadingYr2?: PatristicReading;
}

export interface DaytimeProperSlot {
  hymn?: Hymn;
  /** Present only on certain solemnities of the Lord. */
  psalmAssignments?: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
  /**
   * Proper antiphons for the daytime psalmody, overriding the psalmody's own.
   * Length 1 = a single antiphon sung around all three psalms; length 3 =
   * one antiphon per psalm (GILH 122). There is no rule for which a given day
   * uses, so the data carries one or three and the assembler renders to match.
   */
  antiphons?: Antiphon[];
  shortReading?: ShortReading;
  versicle?: Versicle;
  concludingPrayer?: ConcludingPrayer;
}

// ---------------------------------------------------------------------------
// Proper of Seasons
// ---------------------------------------------------------------------------

export interface SeasonalProperDay {
  key: SeasonalDayKey;
  invitatoryAntiphon?: Antiphon;
  officeOfReadings?: OorProperSlot;
  /** First Vespers: present only on Sundays and solemnities of the season. */
  firstVespers?: VespersProperSlot;
  lauds?: LaudsProperSlot;
  terce?: DaytimeProperSlot;
  sext?:  DaytimeProperSlot;
  none?:  DaytimeProperSlot;
  vespers?: VespersProperSlot;
  // Compline has no seasonal proper content (always from psalter).
}

// ---------------------------------------------------------------------------
// Proper of Saints
// ---------------------------------------------------------------------------

export type CommonType =
  | "dedication_of_a_church"
  | "bvm"
  | "apostles"
  | "martyrs"
  | "pastors"
  | "doctors"
  | "virgins"
  | "holy_men_women";

export type CalendarPosition =
  | { type: "fixed"; month: number; day: number }
  | { type: "moveable"; key: SeasonalDayKey };

export interface SaintEntry {
  id: string;

  invitatoryAntiphon?: Antiphon;
  officeOfReadings?: OorProperSlot & {
    hagiographicalReading?: HagiographicalReading;
  };
  /** First Vespers: present only when rank === "solemnity". */
  firstVespers?: VespersProperSlot;
  lauds?: LaudsProperSlot & {
    /** Absent when the day takes its collect from the Common instead. */
    concludingPrayer?: ConcludingPrayer;
  };
  terce?: { shortReading?: ShortReading; concludingPrayer?: ConcludingPrayer };
  sext?:  { shortReading?: ShortReading; concludingPrayer?: ConcludingPrayer };
  none?:  { shortReading?: ShortReading; concludingPrayer?: ConcludingPrayer };
  vespers?: VespersProperSlot & {
    /** Absent when the day takes its collect from the Common instead. */
    concludingPrayer?: ConcludingPrayer;
  };
}

// ---------------------------------------------------------------------------
// Commons of Saints
// ---------------------------------------------------------------------------

/** A complete set of Hour texts for one variant within a Common.
 *  No optional fields — the Common is the fallback terminus. */
export interface CommonVariant {
  label: string;   // e.g. "For one martyr", "For several martyrs"
  invitatoryAntiphon: Antiphon;
  officeOfReadings: Omit<Required<OorProperSlot>, "hymn"> & {
    /** OoR keeps the night/day alternation — time of recitation, not week parity. */
    hymns: OorHymnSet;
    hagiographicalReading: HagiographicalReading;
  };
  firstVespers: Required<VespersProperSlot>;
  lauds: Required<LaudsProperSlot>;
  terce: Required<DaytimeProperSlot> & { hymn: Hymn };
  sext:  Required<DaytimeProperSlot> & { hymn: Hymn };
  none:  Required<DaytimeProperSlot> & { hymn: Hymn };
  vespers: Required<VespersProperSlot>;
}

export interface Common {
  type: CommonType;
  variants: CommonVariant[];
}
