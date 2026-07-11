/**
 * Shared hour/slot addressing for per-day options.
 *
 * Option ids are `"<hourKey>.<slotKey>"` (+ `.source` / `[...].melody`
 * suffixes).  The assemblers and the options enumerator both derive their
 * paths from this module so the ids they use can never diverge.
 */

import type {
  AbstractCompline, AbstractDay, AbstractDaytimePrayer, AbstractInvitatory,
  AbstractLauds, AbstractOfficeOfReadings, AbstractVespers, SlotSource,
} from "../types/hours.js";

export type HourKey =
  | "invitatory"
  | "officeOfReadings"
  | "lauds"
  | "terce"
  | "sext"
  | "none"
  | "firstVespers"
  | "vespers"
  | "compline";

/** One addressable slot of a built AbstractDay. */
export interface DaySlot {
  hourKey: HourKey;
  /** Runtime field name without the `Ref` suffix, e.g. "hymn", "psalmSlots[0]". */
  slotKey: string;
  source: SlotSource;
}

/** Option-path prefix for a slot ("lauds.hymn"). */
export function slotPath(hourKey: HourKey, slotKey: string): string {
  return `${hourKey}.${slotKey}`;
}

function push(
  out: DaySlot[],
  hourKey: HourKey,
  slotKey: string,
  source: SlotSource | null | undefined,
): void {
  if (source) out.push({ hourKey, slotKey, source });
}

function invitatorySlots(out: DaySlot[], h: AbstractInvitatory): void {
  push(out, "invitatory", "psalm", h.psalmRef);
  push(out, "invitatory", "antiphon", h.antiphonRef);
}

function oorSlots(out: DaySlot[], h: AbstractOfficeOfReadings): void {
  const k = "officeOfReadings";
  push(out, k, "hymn", h.hymnRef);
  h.psalmSlots.forEach((s, i) => push(out, k, `psalmSlots[${i}]`, s.assignmentRef));
  push(out, k, "versicle", h.versicleRef);
  push(out, k, "biblicalReading", h.biblicalReadingRef);
  push(out, k, "patristicReading", h.patristicReadingRef);
  push(out, k, "concludingPrayer", h.concludingPrayerRef);
  if (h.memoriaAddendum) {
    push(out, k, "memoriaAddendum.hagiographicalReading", h.memoriaAddendum.hagiographicalReadingRef);
    push(out, k, "memoriaAddendum.concludingPrayer", h.memoriaAddendum.concludingPrayerRef);
  }
}

function laudsSlots(out: DaySlot[], h: AbstractLauds): void {
  const k = "lauds";
  push(out, k, "hymn", h.hymnRef);
  h.psalmSlots.forEach((s, i) => push(out, k, `psalmSlots[${i}]`, s.assignmentRef));
  push(out, k, "shortReading", h.shortReadingRef);
  push(out, k, "shortResponsory", h.shortResponsoryRef);
  push(out, k, "benedictusAntiphon", h.benedictusAntiphonRef);
  push(out, k, "intercessions", h.intercessionsRef);
  push(out, k, "concludingPrayer", h.concludingPrayerRef);
  if (h.memoriaAddendum) {
    push(out, k, "memoriaAddendum.antiphon", h.memoriaAddendum.antiphonRef);
    push(out, k, "memoriaAddendum.concludingPrayer", h.memoriaAddendum.concludingPrayerRef);
  }
}

function daytimeSlots(out: DaySlot[], h: AbstractDaytimePrayer): void {
  const k = h.kind;
  push(out, k, "hymn", h.hymnRef);
  h.psalmSlots.forEach((s, i) => push(out, k, `psalmSlots[${i}]`, s.assignmentRef));
  push(out, k, "properAntiphons", h.properAntiphonsRef);
  push(out, k, "shortReading", h.shortReadingRef);
  push(out, k, "versicle", h.versicleRef);
  push(out, k, "concludingPrayer", h.concludingPrayerRef);
}

function vespersSlots(out: DaySlot[], h: AbstractVespers): void {
  const k: HourKey = h.isFirstVespers ? "firstVespers" : "vespers";
  push(out, k, "hymn", h.hymnRef);
  h.psalmSlots.forEach((s, i) => push(out, k, `psalmSlots[${i}]`, s.assignmentRef));
  push(out, k, "shortReading", h.shortReadingRef);
  push(out, k, "shortResponsory", h.shortResponsoryRef);
  push(out, k, "magnificatAntiphon", h.magnificatAntiphonRef);
  push(out, k, "intercessions", h.intercessionsRef);
  push(out, k, "concludingPrayer", h.concludingPrayerRef);
  if (h.memoriaAddendum) {
    push(out, k, "memoriaAddendum.antiphon", h.memoriaAddendum.antiphonRef);
    push(out, k, "memoriaAddendum.concludingPrayer", h.memoriaAddendum.concludingPrayerRef);
  }
}

function complineSlots(out: DaySlot[], h: AbstractCompline): void {
  const k = "compline";
  push(out, k, "hymn", h.hymnRef);
  h.psalmSlots.forEach((s, i) => push(out, k, `psalmSlots[${i}]`, s.assignmentRef));
  push(out, k, "shortReading", h.shortReadingRef);
  push(out, k, "nuncDimittisAntiphon", h.nuncDimittisAntiphonRef);
  push(out, k, "concludingPrayer", h.concludingPrayerRef);
  push(out, k, "marianAntiphon", h.marianAntiphonRef);
}

/** Every addressable slot of a built day, in liturgical order. */
export function daySlots(day: AbstractDay): DaySlot[] {
  const out: DaySlot[] = [];
  invitatorySlots(out, day.invitatory);
  oorSlots(out, day.officeOfReadings);
  laudsSlots(out, day.lauds);
  if (day.terce) daytimeSlots(out, day.terce);
  if (day.sext) daytimeSlots(out, day.sext);
  if (day.none) daytimeSlots(out, day.none);
  if (day.firstVespers) vespersSlots(out, day.firstVespers);
  vespersSlots(out, day.vespers);
  complineSlots(out, day.compline);
  return out;
}
