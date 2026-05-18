/**
 * Sanctoral calendar schedule — when saints are celebrated (universal + local).
 *
 * Liturgical texts remain in proper_of_saints; entries here share the same `id`.
 */

import type { CalendarPosition, CommonType } from "./proper.js";

export type SanctoralRank =
  | "solemnity"
  | "feast"
  | "obligatory_memoria"
  | "optional_memoria";

export interface SanctoralCalendarEntry {
  id: string;
  name: string;
  rank: SanctoralRank;
  calendarPosition: CalendarPosition;
  applicableCommons: CommonType[];
  /** Key into the TS transfer-rule registry (e.g. annunciation_gnly60). */
  transferRule?: string;
}

/** Partial patch applied to an existing universal entry. */
export type SanctoralCalendarOverride = Partial<
  Omit<SanctoralCalendarEntry, "id">
> & { id: string };

export interface ParticularCalendarOverlay {
  calendarId: string;
  extends: string;
  additions?: SanctoralCalendarEntry[];
  overrides?: SanctoralCalendarOverride[];
  suppressions?: string[];
}

export interface SanctoralCalendarIndexEntry {
  layer: "universal" | "particular";
  entries?: string;
  extends?: string;
  overlay?: string;
}

export interface SanctoralCalendarIndex {
  calendars: Record<string, SanctoralCalendarIndexEntry>;
}

export interface SanctoralCalendarEntriesFile {
  entries: SanctoralCalendarEntry[];
}

/** Runtime saint compiled from YAML + transfer rules. */
export interface CalendarSaint {
  saintId: string;
  rank: SanctoralRank;
  applicableCommons: CommonType[];
  nominalDate(year: number): Date;
  celebrationDate(year: number): Date;
}
