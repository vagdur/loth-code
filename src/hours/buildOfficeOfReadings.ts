/**
 * Build an AbstractOfficeOfReadings for a given liturgical day and assembly context.
 */

import type { AssemblyContext, LiturgicalDay } from "../types/calendar.js";
import type { AbstractOfficeOfReadings, PsalmSlot, SlotSource } from "../types/hours.js";

import {
  biblicalReadingRef, concludingPrayerRef, officeOfReadingsHymnRef,
  patristicReadingRef, psalmAssignmentRef,
} from "./resolver.js";
import { makeCtx, makeFlags, psalmSlot } from "./shared.js";

export function buildOfficeOfReadings(
  day: LiturgicalDay,
  context: AssemblyContext,
): AbstractOfficeOfReadings {
  const ctx = makeCtx(day);
  const { celebration: c, psalterWeek: w, psalterDay: d } = day;

  // Te Deum: said on Sundays (outside Lent), octaves of Easter/Christmas,
  // solemnities, and feasts. Not on memorias or ferial days (GILH 68).
  const teDeum =
    !["lent", "holy_week"].includes(day.season) &&
    ["sunday", "solemnity", "feast", "feast_of_lord_on_sunday"].includes(c.type);

  const flags = makeFlags(day, teDeum);

  const hymnExplicit = officeOfReadingsHymnRef(ctx, context.oorSaidAtNight);

  // Psalmody: proper on Triduum / octaves / solemnities / feasts; psalter otherwise.
  const usesProperPsalmody =
    c.type === "solemnity" ||
    c.type === "feast" ||
    c.type === "feast_of_lord_on_sunday" ||
    day.celebration.isTriduum;

  const psalmSlots: [PsalmSlot, PsalmSlot, PsalmSlot] = [
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[0]", usesProperPsalmody)),
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[1]", usesProperPsalmody)),
    psalmSlot(psalmAssignmentRef(ctx, "officeOfReadings.psalmAssignments[2]", usesProperPsalmody)),
  ];

  const versicle: SlotSource = c.seasonalKey
    ? {
        kind: "fallback_chain",
        sources: [
          { kind: "seasonal", key: c.seasonalKey, field: "officeOfReadings.versicle" },
          { kind: "psalter", week: w, day: d, field: "officeOfReadings.versicle" },
        ],
      }
    : { kind: "psalter", week: w, day: d, field: "officeOfReadings.versicle" };

  const biblicalReading = biblicalReadingRef(ctx, day.readingYear);
  const patristicReading = patristicReadingRef(ctx, day.readingYear);
  const concludingPrayer = concludingPrayerRef(ctx, "oor");

  // Memoria addendum (office-spec §9.2).
  const memoriaAddendum =
    c.allowMemoriaAddendum && c.saintId
      ? {
          hagiographicalReadingRef: {
            kind: "saint" as const,
            id: c.saintId,
            field: "officeOfReadings.hagiographicalReading",
          },
          concludingPrayerRef: {
            kind: "saint" as const,
            id: c.saintId,
            field: "lauds.concludingPrayer",
          },
        }
      : undefined;

  return {
    kind: "office_of_readings",
    liturgicalDay: day,
    flags,
    isFirstHour: context.oorIsFirstHour,
    hymnRef: hymnExplicit,
    psalmSlots,
    versicleRef: versicle,
    biblicalReadingRef: biblicalReading,
    patristicReadingRef: patristicReading,
    concludingPrayerRef: concludingPrayer,
    ...(memoriaAddendum ? { memoriaAddendum } : {}),
  };
}
