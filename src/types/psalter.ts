/**
 * The four-week psalter cycle — ferial defaults for every Hour.
 */

import type {
  Antiphon, ConcludingPrayer, Hymn, HymnSet, Intercessions,
  OorHymnSet, PsalmAssignment, ShortReading, ShortResponsory, Versicle,
} from "./texts.js";

export type PsalterWeek = 1 | 2 | 3 | 4;

export type Weekday =
  | "Sunday" | "Monday" | "Tuesday" | "Wednesday"
  | "Thursday" | "Friday" | "Saturday";

export interface DaytimeHourEntry {
  hymn: Hymn;
  /** Three psalms (or psalm-sections) with their antiphons. */
  psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
  shortReading: ShortReading;
  versicle: Versicle;
  concludingPrayer: ConcludingPrayer;
}

export interface PsalterDay {
  week: PsalterWeek;
  day: Weekday;

  invitatoryAntiphon: Antiphon;

  officeOfReadings: {
    /** Two hymns: choose by time of recitation (night vs. day). */
    hymns: OorHymnSet;
    psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
    versicle: Versicle;
    // Readings come from proper_of_seasons, not the psalter.
  };

  lauds: {
    /** Two hymns: series_a for Weeks I/III, series_b for Weeks II/IV. */
    hymns: HymnSet;
    /** [morning psalm, OT canticle, psalm of praise] */
    psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
    shortReading: ShortReading;
    shortResponsory: ShortResponsory;
    benedictusAntiphon: Antiphon;
    intercessions: Intercessions;
    concludingPrayer: ConcludingPrayer;
  };

  terce: DaytimeHourEntry;
  sext:  DaytimeHourEntry;
  none:  DaytimeHourEntry;

  /**
   * First Vespers of the Sunday (said Saturday evening; stored on the
   * SUNDAY entry it belongs to). Present only on Sunday psalter days.
   */
  firstVespers?: {
    hymns: HymnSet;
    /** [psalm 1, psalm 2, NT canticle (Phil 2)] */
    psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
    shortReading: ShortReading;
    shortResponsory: ShortResponsory;
    magnificatAntiphon: Antiphon;
    intercessions: Intercessions;
    concludingPrayer: ConcludingPrayer;
  };

  vespers: {
    hymns: HymnSet;
    /** [psalm 1, psalm 2, NT canticle] */
    psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
    shortReading: ShortReading;
    shortResponsory: ShortResponsory;
    magnificatAntiphon: Antiphon;
    intercessions: Intercessions;
    concludingPrayer: ConcludingPrayer;
  };

  compline: {
    hymn: Hymn;
    /** Psalmody when Compline follows First Vespers of Sunday: Ps 4 + Ps 133. */
    afterFirstVespers: [PsalmAssignment, PsalmAssignment];
    /** Psalmody when Compline follows Second Vespers of Sunday: Ps 90. */
    afterSecondVespers: [PsalmAssignment];
    /** Ferial psalmody (psalms expressing confidence in God). */
    defaultPsalmAssignments: PsalmAssignment[];
    shortReading: ShortReading;
    nuncDimittisAntiphon: Antiphon;
    /** Always from the psalter, regardless of day class (GILH 198). */
    concludingPrayer: ConcludingPrayer;
  };
}

/** Groups of three gradual psalms used as complementary psalmody for Daytime Prayer. */
export interface ComplementaryPsalmGroup {
  id: string;
  psalmAssignments: [PsalmAssignment, PsalmAssignment, PsalmAssignment];
}
