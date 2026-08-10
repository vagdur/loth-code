/**
 * Layer 2 — Abstract Hours.
 *
 * An AbstractHour describes WHICH texts belong in each slot, without containing
 * the text itself.  Each slot is a SlotSource: a reference into the data
 * collections that an assembler can resolve via the DataRepository.
 *
 * Fallback chains are encoded explicitly as FallbackChain nodes so the
 * assembler can walk them without re-implementing liturgical logic.
 */

import type { AssemblyContext, LiturgicalDay } from "./calendar.js";
import type { CommonType, SeasonalDayKey } from "./proper.js";
import type { PsalterWeek, Weekday } from "./psalter.js";

// ---------------------------------------------------------------------------
// SlotSource — the "pointer" type
// ---------------------------------------------------------------------------

/** A direct reference to a field within a specific data collection entry. */
export type SlotSourceDirect =
  | { kind: "psalter";  week: PsalterWeek; day: Weekday;  field: string }
  | { kind: "seasonal"; key: SeasonalDayKey;              field: string }
  | { kind: "saint";    id: string;                       field: string }
  | { kind: "common";   type: CommonType; variant: number; field: string }
  | { kind: "fixed";                                      field: string }
  | { kind: "psalm";    id: string }      // looks up Psalm by id
  | { kind: "canticle"; id: string }      // looks up Canticle by id
  | { kind: "complementary"; groupId: string; index: 0 | 1 | 2 };

/**
 * An ordered list of direct sources.  The assembler resolves each in turn
 * and uses the first that yields a non-null value.
 */
export interface FallbackChain {
  kind: "fallback_chain";
  sources: SlotSourceDirect[];
  /**
   * Present when the tail of this chain is rubrically ad libitum
   * (office-spec §5.4) rather than mere data fallback.  Sources
   * [0, adLibFrom) are strict precedence; sources [adLibFrom, end) are a
   * free choice IF the strict head yields nothing.  Absent ⇒ the whole
   * chain is strict first-non-null.
   */
  adLibFrom?: number;
}

export type SlotSource = SlotSourceDirect | FallbackChain;

// ---------------------------------------------------------------------------
// Shared sub-structures
// ---------------------------------------------------------------------------

/** References to a psalm/canticle and its antiphon as used in one psalmody slot. */
export interface PsalmSlot {
  /** Resolves to a PsalmAssignment (contains both psalmOrCanticleId and antiphon). */
  assignmentRef: SlotSource;
}

/** Liturgical flags that affect rendering but don't change slot sources. */
export interface LiturgicalFlags {
  /** Eastertide: append Alleluia to antiphons (unless antiphon.suppressAlleluia). */
  alleluiaInAntiphons: boolean;
  /** Not Lent: include Alleluia in the introductory verse. */
  alleluiaInIntroVerse: boolean;
  /** Whether the Te Deum is said after the second OoR reading. */
  teDeum: boolean;
}

// ---------------------------------------------------------------------------
// Abstract hours
// ---------------------------------------------------------------------------

export interface AbstractInvitatory {
  kind: "invitatory";
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  /** Psalm 94 by default; Ps 99, 66, or 23 may be substituted. */
  psalmRef: SlotSource;
  antiphonRef: SlotSource;
}

export interface AbstractOfficeOfReadings {
  kind: "office_of_readings";
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  /** If true, the Invitatory precedes; otherwise the introductory verse is used. */
  isFirstHour: boolean;
  /**
   * Present when this hour begins the day (office-spec §3.1 / GILH 34–36).
   * Assemblers emit the invitatory verse and psalm with antiphon before the hymn.
   */
  invitatory?: AbstractInvitatory;
  /** Resolved to the specific hymn (night or day series already chosen). */
  hymnRef: SlotSource;
  psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot];
  versicleRef: SlotSource;
  biblicalReadingRef: SlotSource;
  patristicReadingRef: SlotSource;
  concludingPrayerRef: SlotSource;
  /**
   * Present when allow_memoria_addendum is true (§5.5 / office-spec §9.2).
   * The addendum is appended after the regular patristic reading.
   */
  memoriaAddendum?: {
    hagiographicalReadingRef: SlotSource;
    concludingPrayerRef: SlotSource;
  };
}

export interface AbstractLauds {
  kind: "lauds";
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  /** Suppressed when the Invitatory immediately precedes Lauds (GILH 41). */
  suppressIntroVerse: boolean;
  /**
   * Present when Lauds begins the day — OoR omitted or said earlier
   * (office-spec §3.1 / GILH 34–36). Assemblers emit the invitatory verse and
   * psalm with antiphon before the hymn; the introductory verse is omitted.
   */
  invitatory?: AbstractInvitatory;
  hymnRef: SlotSource;
  /** [morning psalm, OT canticle, psalm of praise] */
  psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot];
  shortReadingRef: SlotSource;
  /** Null when the responsory is legitimately omitted. */
  shortResponsoryRef: SlotSource | null;
  benedictusAntiphonRef: SlotSource;
  intercessionsRef: SlotSource;
  concludingPrayerRef: SlotSource;
  /** Optional addendum after the concluding prayer in privileged seasons (§9.2). */
  memoriaAddendum?: {
    antiphonRef: SlotSource;
    concludingPrayerRef: SlotSource;
  };
}

export interface AbstractDaytimePrayer {
  kind: "terce" | "sext" | "none";
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  hymnRef: SlotSource;
  /** Current or complementary psalmody, resolved by the builder. */
  psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot];
  /**
   * Optional proper antiphon override (resolves to an Antiphon[] of length
   * 1 or 3). When present it replaces the psalmody's own antiphons: one
   * antiphon wraps all three psalms, three give one antiphon per psalm.
   * Absent → each psalm keeps its assignment's antiphon.
   */
  properAntiphonsRef?: SlotSource;
  shortReadingRef: SlotSource;
  versicleRef: SlotSource;
  concludingPrayerRef: SlotSource;
}

export interface AbstractVespers {
  kind: "vespers";
  isFirstVespers: boolean;
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  hymnRef: SlotSource;
  /** [psalm 1, psalm 2, NT canticle] */
  psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot];
  shortReadingRef: SlotSource;
  shortResponsoryRef: SlotSource | null;
  magnificatAntiphonRef: SlotSource;
  intercessionsRef: SlotSource;
  concludingPrayerRef: SlotSource;
  memoriaAddendum?: {
    antiphonRef: SlotSource;
    concludingPrayerRef: SlotSource;
  };
}

export interface AbstractCompline {
  kind: "compline";
  liturgicalDay: LiturgicalDay;
  flags: LiturgicalFlags;
  hymnRef: SlotSource;
  /** Resolved by the builder from the Compline context. */
  psalmSlots: PsalmSlot[];
  shortReadingRef: SlotSource;
  nuncDimittisAntiphonRef: SlotSource;
  concludingPrayerRef: SlotSource;
  /** Seasonal Marian antiphon (Regina caeli always in Eastertide). */
  marianAntiphonRef: SlotSource;
}

export type AbstractHour =
  | AbstractInvitatory
  | AbstractOfficeOfReadings
  | AbstractLauds
  | AbstractDaytimePrayer
  | AbstractVespers
  | AbstractCompline;

// ---------------------------------------------------------------------------
// buildDay output
// ---------------------------------------------------------------------------

/**
 * The complete set of abstract hours for one liturgical day.
 * Hours that are not applicable (e.g. no First Vespers on a ferial Saturday)
 * are absent.
 */
export interface AbstractDay {
  liturgicalDay: LiturgicalDay;
  context: AssemblyContext;
  invitatory: AbstractInvitatory;
  officeOfReadings: AbstractOfficeOfReadings;
  lauds: AbstractLauds;
  terce?: AbstractDaytimePrayer;
  sext?:  AbstractDaytimePrayer;
  none?:  AbstractDaytimePrayer;
  /**
   * firstVespers: Vespers of THIS evening belonging to tomorrow's celebration,
   * present only when that First Vespers outranks today's Vespers (GILH n. 61).
   * When set, it is the evening office to pray (see eveningVespers()).
   * vespers: Vespers of THIS day's celebration (always built; second Vespers
   * if solemnity). Suppressed for prayer when firstVespers is present.
   */
  firstVespers?: AbstractVespers;
  vespers: AbstractVespers;
  compline: AbstractCompline;
}
