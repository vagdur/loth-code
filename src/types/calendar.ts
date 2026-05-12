/**
 * Liturgical calendar types — the output of calendar resolution.
 * These drive Layer 2 (the abstract hour builders).
 */

import type { CommonType, SeasonalDayKey } from "./proper.js";
import type { PsalterWeek, Weekday } from "./psalter.js";

export type Season =
  | "advent"
  | "christmas"
  | "ordinary_time"
  | "lent"
  | "holy_week"
  | "easter_triduum"
  | "eastertide";

export type DayClass =
  | "triduum"
  | "sunday"
  | "solemnity"
  | "feast_of_lord_on_sunday"  // feast of the Lord occurring on an OT Sunday
  | "feast"
  | "obligatory_memoria"
  | "optional_memoria"
  | "privileged_ferial"         // Advent/Christmas/Lent/Eastertide/Holy Week ferial
  | "ordinary_ferial";

/** Year I = odd civil year; Year II = even civil year. */
export type ReadingYear = "I" | "II";

export interface Celebration {
  type: DayClass;
  source: "seasonal" | "saint";
  /** Set when source === "seasonal". */
  seasonalKey?: SeasonalDayKey;
  /** Set when source === "saint". */
  saintId?: string;
  /**
   * Ordered fallback commons for this celebration.
   * Empty for purely seasonal days.
   */
  applicableCommons: CommonType[];

  // Pre-computed flags consumed by the hour builders (office-spec §5.5):
  /** No saint texts used at all (fully suppressed memoria). */
  memoriaFullySuppressed: boolean;
  /** Obligatory memoria treated as optional this day. */
  memoriaReducedToOptional: boolean;
  /** Optional addendum (hagiographical reading + antiphon) permitted. */
  allowMemoriaAddendum: boolean;
  /** This day is within the Easter Triduum. */
  isTriduum: boolean;
}

export interface EveningContext {
  /** True when this evening belongs to First Vespers of tomorrow's celebration. */
  hasFirstVespers: boolean;
  firstVespersCelebration?: Celebration;
}

export interface LiturgicalDay {
  date: Date;
  season: Season;
  psalterWeek: PsalterWeek;
  /** Day of week as used to look up the psalter entry. */
  psalterDay: Weekday;
  readingYear: ReadingYear;
  /**
   * The current week number within Ordinary Time (1–34).
   * Used for the OoR reading selection. Set to 0 outside OT.
   */
  ordinaryTimeWeek: number;

  celebration: Celebration;
  evening: EveningContext;

  /** True on ordinary Saturdays where the optional BVM memoria is permitted. */
  saturdayBvmPermitted: boolean;
}

// ---------------------------------------------------------------------------
// Assembly context — runtime decisions that cannot come from data alone
// ---------------------------------------------------------------------------

export type ComplineFollows =
  | "after_first_vespers"
  | "after_second_vespers"
  | "after_ferial_vespers";

export interface AssemblyContext {
  /** Which Daytime Hours are being said today. Affects complementary psalmody. */
  daytimeHoursSaid: Array<"terce" | "sext" | "none">;
  /** If true, the Invitatory precedes the Office of Readings. */
  oorIsFirstHour: boolean;
  /** If true AND oorIsFirstHour, suppresses Lauds' introductory verse. */
  laudsFollowsOorDirectly: boolean;
  /** Selects the night vs. day hymn for the Office of Readings in Ordinary Time. */
  oorSaidAtNight: boolean;
  /** Determines Compline's psalmody selection. */
  complineFollows: ComplineFollows;
  /** Calendar identifier (diocese, religious family, universal, etc.). */
  calendarId: string;
}
